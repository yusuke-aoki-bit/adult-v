/**
 * API layer logging utilities
 * Built on top of the structured logger system
 */

import { NextResponse } from 'next/server';
import { logger, LogContext } from './logger';
import { logError } from './error-handling';

// API operations logger
const apiLogger = logger.child({ layer: 'api-handlers' });

export interface ApiErrorContext extends LogContext {
  endpoint?: string;
  method?: string;
  statusCode?: number;
}

/**
 * Create an error response and log the error
 * Use for API endpoints that need to return an error to the client
 *
 * @example
 * ```typescript
 * try {
 *   const data = await getData();
 *   return NextResponse.json(data);
 * } catch (error) {
 *   return createApiErrorResponse(error, 'Failed to fetch data', 500, {
 *     endpoint: '/api/data',
 *   });
 * }
 * ```
 */
export function createApiErrorResponse(
  error: unknown,
  userMessage: string,
  statusCode: number = 500,
  context?: ApiErrorContext,
): NextResponse {
  const operation = context?.endpoint || 'API request';

  apiLogger.error(`${operation} failed`, error, {
    ...context,
    statusCode,
  });

  // Send to Sentry in production
  if (process.env['NODE_ENV'] === 'production') {
    logError(error, { ...context, statusCode });
  }

  return NextResponse.json({ error: userMessage }, { status: statusCode });
}

/**
 * Log a non-critical API warning
 * Use for issues that don't prevent the request from completing
 *
 * @example
 * ```typescript
 * try {
 *   await moderateContent(data);
 * } catch (error) {
 *   logApiWarning(error, 'Content moderation failed, proceeding anyway');
 * }
 * ```
 */
export function logApiWarning(error: unknown, operation: string, context?: LogContext): void {
  apiLogger.warn(`${operation} (non-critical)`, {
    ...context,
    operation,
    error: error instanceof Error ? error.message : String(error),
  });
}

/**
 * Log API request info
 *
 * @example
 * ```typescript
 * logApiInfo('Request received', { endpoint: '/api/data', method: 'GET' });
 * ```
 */
export function logApiInfo(message: string, context?: ApiErrorContext): void {
  apiLogger.info(message, context);
}

/**
 * Create a child logger for a specific API endpoint
 *
 * @example
 * ```typescript
 * const reviewsLogger = createApiEndpointLogger('/api/reviews');
 * reviewsLogger.info('Processing review submission');
 * ```
 */
export function createApiEndpointLogger(endpoint: string) {
  return apiLogger.child({ endpoint });
}

/**
 * Execute an API operation with timing and error logging
 *
 * @example
 * ```typescript
 * const result = await withApiLogging('processReview', async () => {
 *   return processReview(data);
 * });
 * ```
 */
export async function withApiLogging<T>(operation: string, fn: () => Promise<T>, context?: LogContext): Promise<T> {
  return apiLogger.time(operation, fn, context);
}
