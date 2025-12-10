/**
 * タイムアウト処理
 *
 * fetch や非同期処理にタイムアウトを設定
 */

/**
 * タイムアウトエラー
 */
export class TimeoutError extends Error {
  constructor(message: string, public readonly timeoutMs: number) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * 指定時間後にタイムアウトするPromiseを作成
 */
function createTimeout(ms: number, message?: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new TimeoutError(message || `Operation timed out after ${ms}ms`, ms));
    }, ms);
  });
}

/**
 * Promiseにタイムアウトを適用
 *
 * @param promise - 対象のPromise
 * @param timeoutMs - タイムアウト時間（ミリ秒）
 * @param message - タイムアウト時のエラーメッセージ
 *
 * @example
 * ```typescript
 * const result = await withTimeout(
 *   fetch('https://api.example.com/slow'),
 *   5000,
 *   'API request timed out'
 * );
 * ```
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message?: string
): Promise<T> {
  return Promise.race([promise, createTimeout(timeoutMs, message)]);
}

/**
 * タイムアウト付きfetch
 *
 * AbortControllerを使用して適切にリクエストをキャンセル
 *
 * @param url - リクエストURL
 * @param options - fetchオプション
 * @param timeoutMs - タイムアウト時間（ミリ秒、デフォルト: 30000）
 *
 * @example
 * ```typescript
 * const response = await fetchWithTimeout(
 *   'https://api.example.com/data',
 *   { method: 'GET' },
 *   10000
 * );
 * ```
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 30000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new TimeoutError(`Request to ${url} timed out after ${timeoutMs}ms`, timeoutMs);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * デフォルトのタイムアウト設定
 */
export const DEFAULT_TIMEOUTS = {
  /** 短いリクエスト（API等） */
  short: 10000,
  /** 標準リクエスト */
  standard: 30000,
  /** 長いリクエスト（大きなファイルダウンロード等） */
  long: 60000,
  /** 非常に長いリクエスト */
  veryLong: 120000,
} as const;
