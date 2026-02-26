/**
 * Proxy対応Fetchユーティリティ（shared package版）
 *
 * 環境変数:
 * - PROXY_URL: プロキシURL (例: http://user:pass@proxy.example.com:8080)
 * - PROXY_ENABLED: プロキシを有効にするかどうか (true/false)
 *
 * Node.js組み込みの undici ProxyAgent を使用。
 */

const PROXY_URL = process.env['PROXY_URL'] || '';
const PROXY_ENABLED = process.env['PROXY_ENABLED'] === 'true';

/**
 * Proxy設定情報を取得（ログ用）
 */
export function getProxyInfo(): { enabled: boolean; url: string } {
  return {
    enabled: PROXY_ENABLED,
    url: PROXY_URL ? PROXY_URL.replace(/:[^:@]+@/, ':****@') : '',
  };
}

/**
 * Proxy対応のfetch関数
 * PROXY_ENABLED=true の場合のみプロキシ経由でリクエスト。
 * タイムアウトとAbortSignalもサポート。
 */
export async function proxyFetch(url: string, init?: RequestInit & { timeout?: number }): Promise<Response> {
  const { timeout, ...fetchInit } = init || {};

  // AbortController でタイムアウト制御
  let controller: AbortController | undefined;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  if (timeout && !fetchInit.signal) {
    controller = new AbortController();
    timeoutId = setTimeout(() => controller!.abort(), timeout);
    fetchInit.signal = controller.signal;
  }

  try {
    if (PROXY_ENABLED && PROXY_URL) {
      const { fetch: undiciFetch, ProxyAgent } = await import('undici');
      const dispatcher = new ProxyAgent(PROXY_URL);
      const response = await undiciFetch(url, {
        ...fetchInit,
        dispatcher,
      } as Parameters<typeof undiciFetch>[1]);
      return response as unknown as Response;
    }
    return fetch(url, fetchInit);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/**
 * リトライ付きProxy fetch
 * ネットワークエラーや5xxはリトライ、4xxは即座に返す
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
