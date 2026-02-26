/**
 * Proxy対応Fetchユーティリティ（shared package版）
 *
 * 動作モード（優先順）:
 * 1. PROXY_URL 指定時 → 固定プロキシを使用（有料プロキシ向け）
 * 2. FREE_PROXY_ENABLED=true → 無料プロキシリストからランダム選択＆ローテーション
 * 3. どちらも未設定 → 直接fetch
 *
 * 環境変数:
 * - PROXY_URL: 固定プロキシURL (例: http://user:pass@proxy.example.com:8080)
 * - PROXY_ENABLED: 固定プロキシを有効化 (true/false)
 * - FREE_PROXY_ENABLED: 無料プロキシローテーションを有効化 (true/false)
 * - FREE_PROXY_TIMEOUT: 無料プロキシの接続タイムアウトms (default: 8000)
 */

const PROXY_URL = process.env['PROXY_URL'] || '';
const PROXY_ENABLED = process.env['PROXY_ENABLED'] === 'true';
const FREE_PROXY_ENABLED = process.env['FREE_PROXY_ENABLED'] === 'true';
const FREE_PROXY_TIMEOUT = parseInt(process.env['FREE_PROXY_TIMEOUT'] || '8000');

// ========== 無料プロキシプール ==========

interface ProxyEntry {
  url: string;
  failures: number;
  lastUsed: number;
}

/** 検証済みプロキシプール */
let proxyPool: ProxyEntry[] = [];
/** 最後にプロキシリストを取得した時刻 */
let lastFetchTime = 0;
/** プロキシリストのTTL（30分） */
const PROXY_LIST_TTL = 30 * 60 * 1000;
/** 最大失敗回数（超えたらプールから除去） */
const MAX_FAILURES = 3;
/** プロキシリスト取得中のロック */
let fetchingProxies = false;

/**
 * 複数のソースから無料プロキシリストを取得
 */
async function fetchFreeProxyList(): Promise<string[]> {
  const proxies: string[] = [];
  const sources = [
    // HTTPS対応プロキシのみ取得
    'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=5000&country=jp,us,sg,kr&ssl=yes&anonymity=elite,anonymous',
    'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
    'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt',
  ];

  for (const sourceUrl of sources) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(sourceUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) continue;
      const text = await response.text();

      // 各行を ip:port 形式でパース
      const lines = text
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => /^\d+\.\d+\.\d+\.\d+:\d+$/.test(l));
      proxies.push(...lines);
    } catch {
      // ソース取得失敗は無視
    }
  }

  // 重複除去してシャッフル
  const unique = [...new Set(proxies)];
  for (let i = unique.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [unique[i], unique[j]] = [unique[j]!, unique[i]!];
  }

  return unique;
}

/**
 * プロキシリストを更新（TTL超過時のみ）
 */
async function refreshProxyPool(): Promise<void> {
  if (fetchingProxies) return;
  if (Date.now() - lastFetchTime < PROXY_LIST_TTL && proxyPool.length > 0) return;

  fetchingProxies = true;
  try {
    const rawList = await fetchFreeProxyList();
    // 上位100個のみ保持（メモリ節約）
    proxyPool = rawList.slice(0, 100).map((url) => ({
      url: `http://${url}`,
      failures: 0,
      lastUsed: 0,
    }));
    lastFetchTime = Date.now();
    console.log(`[proxy-fetch] Free proxy pool refreshed: ${proxyPool.length} proxies`);
  } catch (error) {
    console.warn(`[proxy-fetch] Failed to refresh proxy pool: ${error instanceof Error ? error.message : 'unknown'}`);
  } finally {
    fetchingProxies = false;
  }
}

/**
 * プールからランダムにプロキシを選択（失敗数が少ないものを優先）
 */
function pickRandomProxy(): ProxyEntry | null {
  // 失敗が多いプロキシを除去
  proxyPool = proxyPool.filter((p) => p.failures < MAX_FAILURES);
  if (proxyPool.length === 0) return null;

  // 最近使っていないプロキシを優先（least-recently-used + ランダム）
  const sorted = [...proxyPool].sort((a, b) => a.lastUsed - b.lastUsed);
  // 上位半分からランダム選択
  const candidates = sorted.slice(0, Math.max(1, Math.ceil(sorted.length / 2)));
  const picked = candidates[Math.floor(Math.random() * candidates.length)]!;
  picked.lastUsed = Date.now();
  return picked;
}

/**
 * プロキシの失敗を記録
 */
function markProxyFailed(proxyUrl: string): void {
  const entry = proxyPool.find((p) => p.url === proxyUrl);
  if (entry) entry.failures++;
}

// ========== メインfetch関数 ==========

/**
 * Proxy設定情報を取得（ログ用）
 */
export function getProxyInfo(): { enabled: boolean; mode: string; url: string; poolSize?: number } {
  if (PROXY_ENABLED && PROXY_URL) {
    return {
      enabled: true,
      mode: 'fixed',
      url: PROXY_URL.replace(/:[^:@]+@/, ':****@'),
    };
  }
  if (FREE_PROXY_ENABLED) {
    return {
      enabled: true,
      mode: 'free-rotation',
      url: '',
      poolSize: proxyPool.length,
    };
  }
  return { enabled: false, mode: 'direct', url: '' };
}

/**
 * undici経由でプロキシfetchを実行
 */
async function fetchViaProxy(
  proxyUrl: string,
  targetUrl: string,
  fetchInit: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const { fetch: undiciFetch, ProxyAgent } = await import('undici');
  const dispatcher = new ProxyAgent({
    uri: proxyUrl,
    requestTls: { rejectUnauthorized: false },
  });
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // undici の型とNode.js標準のRequestInitの互換性問題を回避
    const response = await undiciFetch(targetUrl, {
      method: fetchInit.method,
      headers: fetchInit.headers as Record<string, string>,
      body: fetchInit.body as string | undefined,
      redirect: fetchInit.redirect,
      signal: controller.signal,
      dispatcher,
    } as any);
    return response as unknown as Response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Proxy対応のfetch関数
 *
 * 優先順:
 * 1. PROXY_ENABLED + PROXY_URL → 固定プロキシ
 * 2. FREE_PROXY_ENABLED → 無料プロキシローテーション（失敗時は直接接続にフォールバック）
 * 3. 直接fetch
 */
export async function proxyFetch(url: string, init?: RequestInit & { timeout?: number }): Promise<Response> {
  const { timeout, ...fetchInit } = init || {};

  // --- モード1: 固定プロキシ ---
  if (PROXY_ENABLED && PROXY_URL) {
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    if (timeout && !fetchInit.signal) {
      timeoutId = setTimeout(() => controller.abort(), timeout);
      fetchInit.signal = controller.signal;
    }
    try {
      return await fetchViaProxy(PROXY_URL, url, fetchInit, timeout || 15000);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  // --- モード2: 無料プロキシローテーション ---
  if (FREE_PROXY_ENABLED) {
    await refreshProxyPool();
    const proxy = pickRandomProxy();

    if (proxy) {
      try {
        const response = await fetchViaProxy(proxy.url, url, fetchInit, FREE_PROXY_TIMEOUT);
        if (response.ok || (response.status >= 300 && response.status < 400)) {
          return response;
        }
        // HTTP エラー → プロキシ失敗としてマーク
        markProxyFailed(proxy.url);
      } catch {
        markProxyFailed(proxy.url);
      }
    }
    // フォールバック: 直接接続
  }

  // --- モード3（デフォルト / フォールバック）: 直接fetch ---
  let controller: AbortController | undefined;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  if (timeout && !fetchInit.signal) {
    controller = new AbortController();
    timeoutId = setTimeout(() => controller!.abort(), timeout);
    fetchInit.signal = controller.signal;
  }
  try {
    return await fetch(url, fetchInit);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/**
 * リトライ付きProxy fetch
 * 無料プロキシモードでは毎回異なるプロキシで再試行
 */
export async function proxyFetchWithRetry(
  url: string,
  options?: RequestInit & { timeout?: number },
  maxRetries: number = 3,
  retryDelayMs: number = 1000,
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await proxyFetch(url, options);

      if (response.ok || (response.status >= 400 && response.status < 500)) {
        return response;
      }

      if (attempt < maxRetries) {
        console.log(`[proxy-fetch] Retry ${attempt}/${maxRetries} for ${url} (status: ${response.status})`);
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempt));
        continue;
      }

      return response;
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries) {
        console.log(`[proxy-fetch] Retry ${attempt}/${maxRetries} for ${url} (error: ${lastError.message})`);
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempt));
        continue;
      }
    }
  }

  throw lastError || new Error(`Failed to fetch ${url} after ${maxRetries} retries`);
}
