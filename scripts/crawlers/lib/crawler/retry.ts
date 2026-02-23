/**
 * リトライロジック
 *
 * ネットワークエラーや一時的な障害に対応するためのリトライ機能
 */

export interface RetryOptions {
  /** 最大リトライ回数（デフォルト: 3） */
  maxRetries?: number;
  /** 初期遅延時間（ミリ秒、デフォルト: 1000） */
  initialDelayMs?: number;
  /** 指数バックオフを使用するか（デフォルト: true） */
  exponentialBackoff?: boolean;
  /** 最大遅延時間（ミリ秒、デフォルト: 30000） */
  maxDelayMs?: number;
  /** リトライ対象のエラーかを判定する関数 */
  shouldRetry?: (error: Error, attempt: number) => boolean;
  /** リトライ時のコールバック */
  onRetry?: (error: Error, attempt: number, delayMs: number) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  exponentialBackoff: true,
  maxDelayMs: 30000,
  shouldRetry: () => true,
  onRetry: () => {},
};

/**
 * リトライ可能なHTTPステータスコード
 */
const RETRYABLE_STATUS_CODES = new Set([
  408, // Request Timeout
  429, // Too Many Requests
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
]);

/**
 * HTTPステータスコードがリトライ可能かを判定
 */
export function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUS_CODES.has(status);
}

/**
 * エラーがリトライ可能かを判定
 */
export function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();

  // ネットワークエラー
  if (
    message.includes('network') ||
    message.includes('econnreset') ||
    message.includes('econnrefused') ||
    message.includes('etimedout') ||
    message.includes('socket') ||
    message.includes('abort')
  ) {
    return true;
  }

  // HTTPエラー
  if (error.name === 'HTTPError' && 'status' in error) {
    return isRetryableStatus((error as any).status);
  }

  return false;
}

/**
 * 遅延時間を計算
 */
function calculateDelay(
  attempt: number,
  initialDelayMs: number,
  exponentialBackoff: boolean,
  maxDelayMs: number,
): number {
  if (!exponentialBackoff) {
    return initialDelayMs;
  }

  // 指数バックオフ: initialDelayMs * 2^attempt
  const delay = initialDelayMs * Math.pow(2, attempt);

  // ジッター（±10%のランダム性）を追加して同時リクエストの衝突を防ぐ
  const jitter = delay * 0.1 * (Math.random() * 2 - 1);

  return Math.min(delay + jitter, maxDelayMs);
}

/**
 * 指定ミリ秒待機
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * リトライ付きで関数を実行
 *
 * @param fn - 実行する非同期関数
 * @param options - リトライオプション
 * @returns 関数の実行結果
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => fetch('https://api.example.com/data'),
 *   {
 *     maxRetries: 5,
 *     initialDelayMs: 500,
 *     onRetry: (err, attempt, delay) => {
 *       console.log(`Retry ${attempt} after ${delay}ms: ${err.message}`);
 *     }
 *   }
 * );
 * ```
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error = new Error('Unknown error');

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // 最後の試行、またはリトライ対象でない場合は即座にエラー
      if (attempt >= opts.maxRetries || !opts.shouldRetry(lastError, attempt)) {
        throw lastError;
      }

      // 遅延時間を計算
      const delayMs = calculateDelay(attempt, opts.initialDelayMs, opts.exponentialBackoff, opts.maxDelayMs);

      // リトライコールバック
      opts.onRetry(lastError, attempt + 1, delayMs);

      // 待機
      await sleep(delayMs);
    }
  }

  throw lastError;
}

/**
 * リトライ付きfetch
 *
 * @param url - リクエストURL
 * @param init - fetch オプション
 * @param retryOptions - リトライオプション
 */
export async function fetchWithRetry(url: string, init?: RequestInit, retryOptions?: RetryOptions): Promise<Response> {
  return withRetry(
    async () => {
      const response = await fetch(url, init);

      // リトライ可能なステータスコードの場合はエラーとして扱う
      if (!response.ok && isRetryableStatus(response.status)) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`) as Error & {
          status: number;
        };
        error.name = 'HTTPError';
        (error as any).status = response.status;
        throw error;
      }

      return response;
    },
    {
      shouldRetry: (error) => isRetryableError(error),
      ...retryOptions,
    },
  );
}
