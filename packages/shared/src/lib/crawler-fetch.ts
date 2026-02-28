/**
 * クローラー共通Fetchユーティリティ
 *
 * 全クローラーで統一的に使用するfetch関数を提供。
 * タイムアウト + プロキシ + リトライを一括処理。
 */

import { proxyFetch } from './proxy-fetch';

const DEFAULT_TIMEOUT = 15_000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_DELAY = 1000;

interface CrawlerFetchOptions extends RequestInit {
  /** タイムアウト (ms) */
  timeout?: number;
  /** リトライ回数 (0=リトライなし) */
  maxRetries?: number;
  /** リトライ間隔 (ms) */
  retryDelay?: number;
}

/**
 * クローラー用fetch
 *
 * proxyFetch (プロキシ対応) + タイムアウト + リトライ
 * ネットワーク障害・5xx エラーのみリトライ。4xx はリトライしない。
 */
export async function crawlerFetch(url: string, options?: CrawlerFetchOptions): Promise<Response> {
  const {
    timeout = DEFAULT_TIMEOUT,
    maxRetries = DEFAULT_MAX_RETRIES,
    retryDelay = DEFAULT_RETRY_DELAY,
    ...fetchInit
  } = options || {};

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await proxyFetch(url, { ...fetchInit, timeout });

      // 4xx はリトライしない（クライアントエラー）
      if (response.status >= 400 && response.status < 500) {
        return response;
      }
      // 成功 or リダイレクト
      if (response.ok || (response.status >= 300 && response.status < 400)) {
        return response;
      }
      // 5xx はリトライ対象
      if (attempt < maxRetries) {
        const delay = retryDelay * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      return response;
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        const delay = retryDelay * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
    }
  }

  throw lastError || new Error(`crawlerFetch failed: ${url}`);
}
