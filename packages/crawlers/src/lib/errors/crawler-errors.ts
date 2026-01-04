/**
 * クローラー統一エラークラス
 *
 * エラーの分類・追跡を容易にするための構造化されたエラー
 */

/**
 * エラーコード
 */
export enum CrawlerErrorCode {
  // ネットワーク系
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  RATE_LIMITED = 'RATE_LIMITED',
  CONNECTION_FAILED = 'CONNECTION_FAILED',

  // パース系
  PARSE_ERROR = 'PARSE_ERROR',
  INVALID_RESPONSE = 'INVALID_RESPONSE',

  // DB系
  DB_CONNECTION = 'DB_CONNECTION',
  DB_CONSTRAINT = 'DB_CONSTRAINT',
  DB_TRANSACTION = 'DB_TRANSACTION',

  // 認証系
  AUTH_FAILED = 'AUTH_FAILED',
  FORBIDDEN = 'FORBIDDEN',

  // 一般
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNKNOWN = 'UNKNOWN',
}

/**
 * エラーコードがリトライ可能かどうかを判定
 */
export function isRetryableErrorCode(code: CrawlerErrorCode): boolean {
  const retryableCodes = new Set<CrawlerErrorCode>([
    CrawlerErrorCode.NETWORK_TIMEOUT,
    CrawlerErrorCode.RATE_LIMITED,
    CrawlerErrorCode.CONNECTION_FAILED,
    CrawlerErrorCode.DB_CONNECTION,
  ]);
  return retryableCodes.has(code);
}

/**
 * クローラーエラー基底クラス
 */
export class CrawlerError extends Error {
  public readonly code: CrawlerErrorCode;
  public readonly retryable: boolean;
  public readonly context?: Record<string, unknown>;
  public readonly originalError?: Error;

  constructor(
    message: string,
    code: CrawlerErrorCode,
    options?: {
      retryable?: boolean;
      context?: Record<string, unknown>;
      originalError?: Error;
    }
  ) {
    super(message);
    this.name = 'CrawlerError';
    this.code = code;
    this.retryable = options?.retryable ?? isRetryableErrorCode(code);
    this.context = options?.context;
    this.originalError = options?.originalError;

    // Error.captureStackTraceが利用可能な場合は使用
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CrawlerError);
    }
  }

  /**
   * 構造化ログ出力用オブジェクトを生成
   */
  toLogObject(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      context: this.context,
      originalError: this.originalError?.message,
      stack: this.stack,
    };
  }
}

/**
 * ネットワークエラー
 */
export class NetworkError extends CrawlerError {
  constructor(
    message: string,
    code: CrawlerErrorCode.NETWORK_TIMEOUT | CrawlerErrorCode.CONNECTION_FAILED | CrawlerErrorCode.RATE_LIMITED,
    options?: {
      url?: string;
      statusCode?: number;
      originalError?: Error;
    }
  ) {
    super(message, code, {
      retryable: true,
      context: {
        url: options?.url,
        statusCode: options?.statusCode,
      },
      originalError: options?.originalError,
    });
    this.name = 'NetworkError';
  }
}

/**
 * パースエラー
 */
export class ParseError extends CrawlerError {
  constructor(
    message: string,
    options?: {
      productId?: string;
      field?: string;
      originalError?: Error;
    }
  ) {
    super(message, CrawlerErrorCode.PARSE_ERROR, {
      retryable: false,
      context: {
        productId: options?.productId,
        field: options?.field,
      },
      originalError: options?.originalError,
    });
    this.name = 'ParseError';
  }
}

/**
 * DBエラー
 */
export class DatabaseError extends CrawlerError {
  constructor(
    message: string,
    code: CrawlerErrorCode.DB_CONNECTION | CrawlerErrorCode.DB_CONSTRAINT | CrawlerErrorCode.DB_TRANSACTION,
    options?: {
      operation?: string;
      table?: string;
      originalError?: Error;
    }
  ) {
    super(message, code, {
      retryable: code === CrawlerErrorCode.DB_CONNECTION,
      context: {
        operation: options?.operation,
        table: options?.table,
      },
      originalError: options?.originalError,
    });
    this.name = 'DatabaseError';
  }
}

/**
 * 検証エラー
 */
export class ValidationError extends CrawlerError {
  constructor(
    message: string,
    options?: {
      productId?: string;
      field?: string;
      value?: unknown;
    }
  ) {
    super(message, CrawlerErrorCode.VALIDATION_ERROR, {
      retryable: false,
      context: {
        productId: options?.productId,
        field: options?.field,
        value: options?.value,
      },
    });
    this.name = 'ValidationError';
  }
}

/**
 * 未知のエラーをCrawlerErrorにラップ
 */
export function wrapError(error: unknown, context?: Record<string, unknown>): CrawlerError {
  if (error instanceof CrawlerError) {
    return error;
  }

  if (error instanceof Error) {
    // エラーメッセージからコードを推測
    const message = error.message.toLowerCase();
    let code = CrawlerErrorCode.UNKNOWN;

    if (message.includes('timeout') || message.includes('timed out')) {
      code = CrawlerErrorCode.NETWORK_TIMEOUT;
    } else if (message.includes('econnrefused') || message.includes('econnreset')) {
      code = CrawlerErrorCode.CONNECTION_FAILED;
    } else if (message.includes('rate limit') || message.includes('too many requests')) {
      code = CrawlerErrorCode.RATE_LIMITED;
    } else if (message.includes('constraint') || message.includes('unique violation')) {
      code = CrawlerErrorCode.DB_CONSTRAINT;
    } else if (message.includes('connection') && message.includes('database')) {
      code = CrawlerErrorCode.DB_CONNECTION;
    }

    return new CrawlerError(error.message, code, {
      context,
      originalError: error,
    });
  }

  return new CrawlerError(String(error), CrawlerErrorCode.UNKNOWN, {
    context,
  });
}
