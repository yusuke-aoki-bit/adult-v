/**
 * Database layer logging utilities
 * Built on top of the structured logger system
 */

import { logger, LogContext } from './logger';
import { logError } from './error-handling';

// DB operations logger
const dbLogger = logger.child({ layer: 'db-queries' });

/**
 * Log a database error and return a default value
 * Use for recoverable errors where the application should continue
 *
 * @example
 * ```typescript
 * try {
 *   return await db.query(...);
 * } catch (error) {
 *   return logDbErrorAndReturn(error, [], 'getProducts');
 * }
 * ```
 */
export function logDbErrorAndReturn<T>(error: unknown, defaultValue: T, operation: string, context?: LogContext): T {
  dbLogger.error(`${operation} failed`, error, {
    ...context,
    operation,
    recoverable: true,
  });

  // Send to Sentry in production (as warning since it's recoverable)
  if (process.env['NODE_ENV'] === 'production') {
    logError(error, { ...context, operation, severity: 'warning' });
  }

  return defaultValue;
}

/**
 * Log a database error and re-throw
 * Use for unrecoverable errors that should propagate
 *
 * @example
 * ```typescript
 * try {
 *   return await db.query(...);
 * } catch (error) {
 *   logDbErrorAndThrow(error, 'createProduct');
 * }
 * ```
 */
export function logDbErrorAndThrow(error: unknown, operation: string, context?: LogContext): never {
  dbLogger.error(`${operation} failed`, error, {
    ...context,
    operation,
    recoverable: false,
  });

  // Send to Sentry in production
  if (process.env['NODE_ENV'] === 'production') {
    logError(error, { ...context, operation });
  }

  throw error;
}

/**
 * Log a database warning (non-critical issues)
 *
 * @example
 * ```typescript
 * if (result.length === 0) {
 *   logDbWarning('No results found', 'getProducts', { query });
 * }
 * ```
 */
export function logDbWarning(message: string, operation: string, context?: LogContext): void {
  dbLogger.warn(message, {
    ...context,
    operation,
  });
}

/**
 * Execute a database operation with timing and error logging
 *
 * @example
 * ```typescript
 * const products = await withDbLogging('getProducts', async () => {
 *   return db.query(...);
 * });
 * ```
 */
export async function withDbLogging<T>(operation: string, fn: () => Promise<T>, context?: LogContext): Promise<T> {
  return dbLogger.time(operation, fn, context);
}

/**
 * Create a child logger for a specific database module
 *
 * @example
 * ```typescript
 * const actressLogger = createDbModuleLogger('actress-queries');
 * actressLogger.info('Fetching actresses', { limit: 10 });
 * ```
 */
export function createDbModuleLogger(moduleName: string) {
  return dbLogger.child({ module: moduleName });
}
