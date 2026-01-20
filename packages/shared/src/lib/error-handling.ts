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
 * Sentryにエラーを送信（利用可能な場合）
 */
async function reportToSentry(error: unknown, context?: ErrorLogContext): Promise<void> {
  try {
    // 動的インポートでSentryを読み込み（オプショナル依存）
    const Sentry = await import('@sentry/nextjs').catch(() => null);
    if (Sentry) {
      Sentry.withScope((scope) => {
        if (context) {
          Object.entries(context).forEach(([key, value]) => {
            scope.setExtra(key, value);
          });
        }
        Sentry.captureException(error);
      });
    }
  } catch {
    // Sentryが利用できない場合は無視
  }
}

/**
 * エラーをログ出力（Sentry統合）
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

  // Sentryにも送信（非同期・ノンブロッキング）
  reportToSentry(error, context).catch(() => {});
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

// ============================================================
// ローカライズ対応エラーメッセージ
// ============================================================

/**
 * ユーザー向けエラーメッセージ（ローカライズ対応）
 */
export const ERROR_MESSAGES = {
  ja: {
    NETWORK_ERROR: 'ネットワークエラーが発生しました。接続を確認してください。',
    SERVER_ERROR: 'サーバーエラーが発生しました。しばらく後に再度お試しください。',
    NOT_FOUND: 'お探しのページが見つかりませんでした。',
    UNAUTHORIZED: 'ログインが必要です。',
    FORBIDDEN: 'このページにアクセスする権限がありません。',
    VALIDATION_ERROR: '入力内容に誤りがあります。',
    TIMEOUT: 'リクエストがタイムアウトしました。再度お試しください。',
    RATE_LIMITED: 'リクエストが多すぎます。しばらく後に再度お試しください。',
    UNKNOWN: '予期せぬエラーが発生しました。',
  },
  en: {
    NETWORK_ERROR: 'Network error occurred. Please check your connection.',
    SERVER_ERROR: 'Server error occurred. Please try again later.',
    NOT_FOUND: 'The page you are looking for was not found.',
    UNAUTHORIZED: 'Authentication required.',
    FORBIDDEN: 'You do not have permission to access this page.',
    VALIDATION_ERROR: 'There are errors in your input.',
    TIMEOUT: 'Request timed out. Please try again.',
    RATE_LIMITED: 'Too many requests. Please try again later.',
    UNKNOWN: 'An unexpected error occurred.',
  },
  zh: {
    NETWORK_ERROR: '发生网络错误。请检查您的连接。',
    SERVER_ERROR: '发生服务器错误。请稍后重试。',
    NOT_FOUND: '找不到您要查找的页面。',
    UNAUTHORIZED: '需要登录。',
    FORBIDDEN: '您没有权限访问此页面。',
    VALIDATION_ERROR: '输入内容有误。',
    TIMEOUT: '请求超时。请重试。',
    RATE_LIMITED: '请求过多。请稍后重试。',
    UNKNOWN: '发生意外错误。',
  },
  ko: {
    NETWORK_ERROR: '네트워크 오류가 발생했습니다. 연결을 확인하세요.',
    SERVER_ERROR: '서버 오류가 발생했습니다. 나중에 다시 시도하세요.',
    NOT_FOUND: '찾으시는 페이지를 찾을 수 없습니다.',
    UNAUTHORIZED: '로그인이 필요합니다.',
    FORBIDDEN: '이 페이지에 액세스할 권한이 없습니다.',
    VALIDATION_ERROR: '입력 내용에 오류가 있습니다.',
    TIMEOUT: '요청 시간이 초과되었습니다. 다시 시도하세요.',
    RATE_LIMITED: '요청이 너무 많습니다. 나중에 다시 시도하세요.',
    UNKNOWN: '예기치 않은 오류가 발생했습니다.',
  },
} as const;

export type ErrorCode = keyof typeof ERROR_MESSAGES['ja'];

/**
 * HTTPステータスコードからエラーコードを取得
 */
export function getErrorCodeFromStatus(status: number): ErrorCode {
  switch (status) {
    case 400:
      return 'VALIDATION_ERROR';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 408:
      return 'TIMEOUT';
    case 429:
      return 'RATE_LIMITED';
    case 500:
    case 502:
    case 503:
    case 504:
      return 'SERVER_ERROR';
    default:
      return 'UNKNOWN';
  }
}

/**
 * ローカライズされたエラーメッセージを取得
 */
export function getLocalizedErrorMessage(
  errorCode: ErrorCode,
  locale: string = 'ja'
): string {
  const messages = ERROR_MESSAGES[locale as keyof typeof ERROR_MESSAGES] || ERROR_MESSAGES.ja;
  return messages[errorCode] || messages.UNKNOWN;
}

/**
 * エラーからユーザー向けメッセージを生成
 */
export function getUserFriendlyErrorMessage(
  error: unknown,
  locale: string = 'ja'
): string {
  // カスタムエラークラスの場合
  if (error instanceof NotFoundError) {
    return getLocalizedErrorMessage('NOT_FOUND', locale);
  }
  if (error instanceof AuthenticationError) {
    return getLocalizedErrorMessage('UNAUTHORIZED', locale);
  }
  if (error instanceof AuthorizationError) {
    return getLocalizedErrorMessage('FORBIDDEN', locale);
  }
  if (error instanceof ValidationError) {
    return getLocalizedErrorMessage('VALIDATION_ERROR', locale);
  }
  if (error instanceof ExternalServiceError) {
    if (error.statusCode) {
      const errorCode = getErrorCodeFromStatus(error.statusCode);
      return getLocalizedErrorMessage(errorCode, locale);
    }
    return getLocalizedErrorMessage('NETWORK_ERROR', locale);
  }
  if (error instanceof DatabaseError) {
    return getLocalizedErrorMessage('SERVER_ERROR', locale);
  }

  // fetch エラーの場合
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return getLocalizedErrorMessage('NETWORK_ERROR', locale);
  }

  // HTTPレスポンスの場合
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status;
    const errorCode = getErrorCodeFromStatus(status);
    return getLocalizedErrorMessage(errorCode, locale);
  }

  return getLocalizedErrorMessage('UNKNOWN', locale);
}
