/**
 * クローラー構造化ログモジュール
 *
 * Cloud Loggingでの検索・分析を容易にするための構造化ログ
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  crawler?: string;
  productId?: string | number;
  operation?: string;
  durationMs?: number;
  [key: string]: unknown;
}

interface StructuredLog {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * ログレベルの優先度
 */
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * 現在のログレベル（環境変数で設定可能）
 */
const CURRENT_LOG_LEVEL: LogLevel = (process.env.CRAWLER_LOG_LEVEL as LogLevel) || 'info';

/**
 * JSON形式でログを出力するか（本番環境用）
 */
const USE_JSON_LOGS = process.env.CRAWLER_JSON_LOGS === 'true' || process.env.NODE_ENV === 'production';

/**
 * ログを出力するべきか判定
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[CURRENT_LOG_LEVEL];
}

/**
 * 構造化ログを出力
 */
function writeLog(log: StructuredLog): void {
  if (!shouldLog(log.level)) {
    return;
  }

  if (USE_JSON_LOGS) {
    // 本番環境: JSON形式（Cloud Logging対応）
    const output = JSON.stringify(log);
    if (log.level === 'error') {
      console.error(output);
    } else if (log.level === 'warn') {
      console.warn(output);
    } else {
      console.log(output);
    }
  } else {
    // 開発環境: 人間が読みやすい形式
    const prefix = getLogPrefix(log.level);
    const contextStr = log.context ? ` ${formatContext(log.context)}` : '';
    const errorStr = log.error ? `\n  Error: ${log.error.message}` : '';

    if (log.level === 'error') {
      console.error(`${prefix} ${log.message}${contextStr}${errorStr}`);
    } else if (log.level === 'warn') {
      console.warn(`${prefix} ${log.message}${contextStr}`);
    } else {
      console.log(`${prefix} ${log.message}${contextStr}`);
    }
  }
}

function getLogPrefix(level: LogLevel): string {
  switch (level) {
    case 'debug':
      return '[DEBUG]';
    case 'info':
      return '[INFO]';
    case 'warn':
      return '[WARN] ⚠️';
    case 'error':
      return '[ERROR] ❌';
  }
}

function formatContext(context: LogContext): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(context)) {
    if (value !== undefined && value !== null) {
      parts.push(`${key}=${value}`);
    }
  }
  return parts.length > 0 ? `(${parts.join(', ')})` : '';
}

/**
 * クローラーロガークラス
 */
export class CrawlerLogger {
  private crawlerName: string;

  constructor(crawlerName: string) {
    this.crawlerName = crawlerName;
  }

  private createLog(level: LogLevel, message: string, context?: LogContext, error?: Error): StructuredLog {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: {
        crawler: this.crawlerName,
        ...context,
      },
      error: error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : undefined,
    };
  }

  debug(message: string, context?: LogContext): void {
    writeLog(this.createLog('debug', message, context));
  }

  info(message: string, context?: LogContext): void {
    writeLog(this.createLog('info', message, context));
  }

  warn(message: string, context?: LogContext): void {
    writeLog(this.createLog('warn', message, context));
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const err = error instanceof Error ? error : error ? new Error(String(error)) : undefined;
    writeLog(this.createLog('error', message, context, err));
  }

  /**
   * 処理開始ログ
   */
  start(operation: string, context?: LogContext): void {
    this.info(`Starting ${operation}`, { operation, ...context });
  }

  /**
   * 処理完了ログ
   */
  complete(operation: string, durationMs: number, context?: LogContext): void {
    this.info(`Completed ${operation}`, { operation, durationMs, ...context });
  }

  /**
   * 進捗ログ
   */
  progress(current: number, total: number, context?: LogContext): void {
    const percent = Math.round((current / total) * 100);
    this.info(`Progress: ${current}/${total} (${percent}%)`, { current, total, percent, ...context });
  }

  /**
   * 商品処理ログ
   */
  productProcessed(productId: string | number, isNew: boolean, context?: LogContext): void {
    this.debug(isNew ? 'New product saved' : 'Product updated', {
      productId,
      isNew,
      ...context,
    });
  }

  /**
   * エラーログ（リトライ可能かどうかを含む）
   */
  retryableError(message: string, error: Error, retryable: boolean, context?: LogContext): void {
    this.error(message, error, { retryable, ...context });
  }
}

/**
 * ロガーインスタンスを作成
 */
export function createLogger(crawlerName: string): CrawlerLogger {
  return new CrawlerLogger(crawlerName);
}

/**
 * 簡易ログ関数（ロガーインスタンスなしで使用）
 */
export const log = {
  debug: (message: string, context?: LogContext) => {
    writeLog({
      timestamp: new Date().toISOString(),
      level: 'debug',
      message,
      context,
    });
  },
  info: (message: string, context?: LogContext) => {
    writeLog({
      timestamp: new Date().toISOString(),
      level: 'info',
      message,
      context,
    });
  },
  warn: (message: string, context?: LogContext) => {
    writeLog({
      timestamp: new Date().toISOString(),
      level: 'warn',
      message,
      context,
    });
  },
  error: (message: string, error?: Error | unknown, context?: LogContext) => {
    const err = error instanceof Error ? error : error ? new Error(String(error)) : undefined;
    writeLog({
      timestamp: new Date().toISOString(),
      level: 'error',
      message,
      context,
      error: err
        ? {
            name: err.name,
            message: err.message,
            stack: err.stack,
          }
        : undefined,
    });
  },
};
