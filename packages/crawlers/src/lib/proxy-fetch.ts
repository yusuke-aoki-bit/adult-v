/**
 * Proxy対応Fetchユーティリティ
 *
 * 環境変数:
 * - PROXY_URL: プロキシURL (例: http://user:pass@proxy.example.com:8080)
 * - PROXY_ENABLED: プロキシを有効にするかどうか (true/false)
 *
 * 使用例:
 * const response = await proxyFetch('https://example.com', { headers: {...} });
 */

import { HttpsProxyAgent } from 'https-proxy-agent';

// Proxy設定
const PROXY_URL = process.env['PROXY_URL'] || '';
const PROXY_ENABLED = process.env['PROXY_ENABLED'] === 'true';

// ProxyAgentのキャッシュ
let cachedAgent: HttpsProxyAgent<string> | null = null;

/**
 * Proxyエージェントを取得
 */
function getProxyAgent(): HttpsProxyAgent<string> | null {
  if (!PROXY_ENABLED || !PROXY_URL) {
    return null;
  }

  if (!cachedAgent) {
    cachedAgent = new HttpsProxyAgent(PROXY_URL);
    console.log('[Proxy] Agent initialized');
  }

  return cachedAgent;
}

/**
 * Proxy設定情報を取得（ログ用）
 */
export function getProxyInfo(): { enabled: boolean; url: string } {
  return {
    enabled: PROXY_ENABLED,
    url: PROXY_URL ? PROXY_URL.replace(/:[^:@]+@/, ':****@') : '', // パスワードを隠す
  };
}

/**
 * Proxy対応のfetch関数
 * 環境変数でProxyが有効な場合のみProxy経由でリクエスト
 */
export async function proxyFetch(url: string | URL, init?: RequestInit & { timeout?: number }): Promise<Response> {
  const agent = getProxyAgent();

  // Node.js 18+のfetchはagentオプションをサポートしていないため
  // undiciを使用するか、node-fetchを使用する必要がある
  // ここではundiciのProxyAgentを使用

  if (agent) {
    // undiciを使用したProxy fetch
    const { fetch: undiciFetch, ProxyAgent } = await import('undici');

    const proxyAgent = new ProxyAgent(PROXY_URL);

    const response = await undiciFetch(url.toString(), {
      ...init,
      dispatcher: proxyAgent,
    } as Parameters<typeof undiciFetch>[1]);

    return response as unknown as Response;
  }

  // Proxyが無効の場合は通常のfetch
  return fetch(url, init);
}

/**
 * MGS用のProxy対応fetch
 * 年齢確認Cookieを自動付与
 */
export async function mgsFetch(url: string, options?: RequestInit): Promise<Response> {
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
    Cookie: 'adc=1',
    ...options?.headers,
  };

  return proxyFetch(url, {
    ...options,
    headers,
  });
}

/**
 * リトライ付きProxy fetch
 */
export async function proxyFetchWithRetry(
  url: string,
  options?: RequestInit,
  maxRetries: number = 3,
  retryDelayMs: number = 1000,
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await proxyFetch(url, options);

      // 成功またはクライアントエラー（4xx）は即座に返す
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        return response;
      }

      // サーバーエラー（5xx）はリトライ
      if (attempt < maxRetries) {
        console.log(`[Proxy] Retry ${attempt}/${maxRetries} for ${url} (status: ${response.status})`);
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempt));
        continue;
      }

      return response;
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries) {
        console.log(`[Proxy] Retry ${attempt}/${maxRetries} for ${url} (error: ${lastError.message})`);
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempt));
        continue;
      }
    }
  }

  throw lastError || new Error(`Failed to fetch ${url} after ${maxRetries} retries`);
}
