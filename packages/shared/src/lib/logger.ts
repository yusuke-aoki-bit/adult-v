/**
 * 構造化ログシステム
 * 本番環境ではCloud Logging互換のJSON形式で出力
 * 開発環境では可読性の高い形式で出力
 */

// ============================================================
// 型定義
// ============================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  /** リクエストID */
  requestId?: string;
  /** ユーザーID */
  userId?: string;
  /** 商品ID */
  productId?: string | number;
  /** 女優ID */
  actressId?: string | number;
  /** 操作名 */
  operation?: string;
  /** 処理時間（ミリ秒） */
  durationMs?: number;
  /** 追加のメタデータ */
  [key: string]: unknown;
}

export interface LogEntry {
  /** ログレベル */
  severity: string;
  /** タイムスタンプ */
  timestamp: string;
  /** メッセージ */
  message: string;
  /** コンテキスト */
  context?: LogContext;
  /** エラー情報 */
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  /** ソースの場所 */
  sourceLocation?: {
    file?: string;
    line?: number;
    function?: string;
  };
}

// ============================================================
// 設定
// ============================================================

const IS_PRODUCTION = process.env['NODE_ENV'] === 'production';
const LOG_LEVEL = (process.env['LOG_LEVEL'] || 'info') as LogLevel;

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Cloud Logging用のseverityマッピング
const SEVERITY_MAP: Record<LogLevel, string> = {
  debug: 'DEBUG',
  info: 'INFO',
  warn: 'WARNING',
  error: 'ERROR',
};

// ============================================================
// ユーティリティ
// ============================================================

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[LOG_LEVEL];
}

function formatError(error: unknown): LogEntry['error'] | undefined {
  if (!error) return undefined;

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      ...(error.stack !== undefined && { stack: error.stack }),
    };
  }

  return {
    name: 'UnknownError',
    message: String(error),
  };
}

function createLogEntry(
  level: LogLevel,
  message: string,
  context?: LogContext,
  error?: unknown
): LogEntry {
  const entry: LogEntry = {
    severity: SEVERITY_MAP[level],
    timestamp: new Date().toISOString(),
    message,
  };
  if (context) {
    entry.context = context;
  }
  const formattedError = formatError(error);
  if (formattedError) {
    entry.error = formattedError;
  }
  return entry;
}

function formatForConsole(entry: LogEntry): string {
  const timePart = entry.timestamp.split('T')[1] ?? '';
  const parts = [
    `[${entry.severity}]`,
    timePart.replace('Z', ''),
    entry.message,
  ];

  if (entry.context?.['operation']) {
    parts.push(`(${entry.context['operation']})`);
  }

  if (entry.context?.durationMs) {
    parts.push(`${entry.context.durationMs}ms`);
  }

  return parts.join(' ');
}

function output(entry: LogEntry, level: LogLevel): void {
  if (IS_PRODUCTION) {
    // 本番: JSON形式（Cloud Logging互換）
    const output = level === 'error' ? console.error : console.log;
    output(JSON.stringify(entry));
  } else {
    // 開発: 可読性重視
    const output =
      level === 'error'
        ? console.error
        : level === 'warn'
          ? console.warn
          : console.log;

    output(formatForConsole(entry));

    if (entry.context && Object.keys(entry.context).length > 0) {
      console.log('  Context:', entry.context);
    }

    if (entry.error) {
      console.log('  Error:', entry.error.message);
      if (entry.error.stack && level === 'error') {
        console.log('  Stack:', entry.error.stack.split('\n').slice(1, 4).join('\n'));
      }
    }
  }
}

// ============================================================
// Logger クラス
// ============================================================

export class Logger {
  private defaultContext: LogContext;

  constructor(context: LogContext = {}) {
    this.defaultContext = context;
  }

  /**
   * 子ロガーを作成（コンテキストを継承）
   */
  child(context: LogContext): Logger {
    return new Logger({ ...this.defaultContext, ...context });
  }

  /**
   * デバッグログ
   */
  debug(message: string, context?: LogContext): void {
    if (!shouldLog('debug')) return;
    const entry = createLogEntry('debug', message, {
      ...this.defaultContext,
      ...context,
    });
    output(entry, 'debug');
  }

  /**
   * 情報ログ
   */
  info(message: string, context?: LogContext): void {
    if (!shouldLog('info')) return;
    const entry = createLogEntry('info', message, {
      ...this.defaultContext,
      ...context,
    });
    output(entry, 'info');
  }

  /**
   * 警告ログ
   */
  warn(message: string, context?: LogContext): void {
    if (!shouldLog('warn')) return;
    const entry = createLogEntry('warn', message, {
      ...this.defaultContext,
      ...context,
    });
    output(entry, 'warn');
  }

  /**
   * エラーログ
   */
  error(message: string, error?: unknown, context?: LogContext): void {
    if (!shouldLog('error')) return;
    const entry = createLogEntry(
      'error',
      message,
      { ...this.defaultContext, ...context },
      error
    );
    output(entry, 'error');
  }

  /**
   * 処理時間を計測してログ出力
   */
  async time<T>(
    operation: string,
    fn: () => Promise<T>,
    context?: LogContext
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      const durationMs = Date.now() - start;
      this.info(`${operation} completed`, {
        ...context,
        operation,
        durationMs,
      });
      return result;
    } catch (error) {
      const durationMs = Date.now() - start;
      this.error(`${operation} failed`, error, {
        ...context,
        operation,
        durationMs,
      });
      throw error;
    }
  }
}

// ============================================================
// デフォルトロガー
// ============================================================

export const logger = new Logger();

// ============================================================
// 便利関数
// ============================================================

/**
 * リクエストスコープのロガーを作成
 */
export function createRequestLogger(requestId: string, userId?: string): Logger {
  const context: LogContext = { requestId };
  if (userId !== undefined) {
    context.userId = userId;
  }
  return new Logger(context);
}

/**
 * 操作スコープのロガーを作成
 */
export function createOperationLogger(operation: string, context?: LogContext): Logger {
  return new Logger({ operation, ...context });
}

/**
 * クローラー用ロガーを作成
 */
export function createCrawlerLogger(crawlerName: string): Logger {
  return new Logger({ operation: `crawler:${crawlerName}` });
}

/**
 * API用ロガーを作成
 */
export function createApiLogger(endpoint: string): Logger {
  return new Logger({ operation: `api:${endpoint}` });
}
