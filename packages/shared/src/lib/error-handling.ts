/**
 * エラーハンドリングユーティリティ
 * アプリケーション全体で一貫したエラー処理を提供
 */

// ============================================================
// カスタムエラークラス
// ============================================================

/**
 * データベースエラー
 */
export class DatabaseError extends Error {
  constructor(
    message: string,
    public readonly originalError?: unknown,
    public readonly query?: string
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

/**
 * バリデーションエラー
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: unknown
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * 認証エラー
 */
export class AuthenticationError extends Error {
  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

/**
 * 認可エラー
 */
export class AuthorizationError extends Error {
  constructor(message: string = 'Access denied') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

/**
 * 外部サービスエラー
 */
export class ExternalServiceError extends Error {
  constructor(
    message: string,
    public readonly serviceName: string,
    public readonly statusCode?: number,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'ExternalServiceError';
  }
}

/**
 * リソース未発見エラー
 */
export class NotFoundError extends Error {
  constructor(
    public readonly resourceType: string,
    public readonly resourceId: string | number
  ) {
    super(`${resourceType} not found: ${resourceId}`);
    this.name = 'NotFoundError';
  }
}

// ============================================================
// リトライユーティリティ
// ============================================================

export interface RetryOptions {
  /** 最大リトライ回数（デフォルト: 3） */
  maxRetries?: number;
  /** 初期遅延時間（ミリ秒、デフォルト: 100） */
  initialDelayMs?: number;
  /** 最大遅延時間（ミリ秒、デフォルト: 5000） */
  maxDelayMs?: number;
  /** 指数バックオフを使用するか（デフォルト: true） */
  exponentialBackoff?: boolean;
  /** リトライ対象かを判定する関数 */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  /** リトライ時のコールバック */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 100,
  maxDelayMs: 5000,
  exponentialBackoff: true,
  shouldRetry: () => true,
  onRetry: () => {},
};

/**
 * 遅延を実行
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 遅延時間を計算（指数バックオフ + ジッター）
 */
function calculateDelay(
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number,
  exponentialBackoff: boolean
): number {
  if (!exponentialBackoff) {
    return initialDelayMs;
  }

  const baseDelay = initialDelayMs * Math.pow(2, attempt);
  const jitter = baseDelay * 0.1 * (Math.random() * 2 - 1);
  return Math.min(baseDelay + jitter, maxDelayMs);
}

/**
 * リトライ付きで関数を実行
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt >= opts.maxRetries || !opts.shouldRetry(error, attempt)) {
        throw error;
      }

      const delayMs = calculateDelay(
        attempt,
        opts.initialDelayMs,
        opts.maxDelayMs,
        opts.exponentialBackoff
      );

      opts.onRetry(error, attempt + 1, delayMs);
      await delay(delayMs);
    }
  }

  throw lastError;
}

// ============================================================
// エラーラッピングユーティリティ
// ============================================================

/**
 * データベース操作をラップしてエラーハンドリング
 */
export async function withDatabaseErrorHandling<T>(
  operation: () => Promise<T>,
  context?: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const message = context
      ? `Database operation failed: ${context}`
      : 'Database operation failed';
    throw new DatabaseError(message, error);
  }
}

/**
 * 外部サービス呼び出しをラップ
 */
export async function withExternalServiceErrorHandling<T>(
  serviceName: string,
  operation: () => Promise<T>
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof ExternalServiceError) {
      throw error;
    }

    const statusCode =
      error instanceof Error && 'status' in error
        ? (error as { status: number }).status
        : undefined;

    throw new ExternalServiceError(
      `External service call failed: ${serviceName}`,
      serviceName,
      statusCode,
      error
    );
  }
}

// ============================================================
// 安全な実行ユーティリティ
// ============================================================

/**
 * 結果型（成功または失敗）
 */
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * 安全に関数を実行してResult型で返す
 */
export async function safeExecute<T>(
  fn: () => Promise<T>
): Promise<Result<T, Error>> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * nullまたはundefinedの場合にデフォルト値を返す
 */
export function withDefault<T>(value: T | null | undefined, defaultValue: T): T {
  return value ?? defaultValue;
}

// ============================================================
// ログ付きエラーハンドリング
// ============================================================

export interface ErrorLogContext {
  operation?: string;
  userId?: string;
  productId?: string | number;
  actressId?: string | number;
  [key: string]: unknown;
}

/**
 * エラーをログ出力
 */
export function logError(error: unknown, context?: ErrorLogContext): void {
  const errorInfo = {
    name: error instanceof Error ? error.name : 'UnknownError',
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    ...context,
    timestamp: new Date().toISOString(),
  };

  console.error('[ERROR]', JSON.stringify(errorInfo, null, 2));
}

/**
 * エラーをログ出力して再スロー
 */
export function logAndRethrow(error: unknown, context?: ErrorLogContext): never {
  logError(error, context);
  throw error;
}

/**
 * エラーをログ出力してnullを返す
 */
export function logAndReturnNull(error: unknown, context?: ErrorLogContext): null {
  logError(error, context);
  return null;
}
