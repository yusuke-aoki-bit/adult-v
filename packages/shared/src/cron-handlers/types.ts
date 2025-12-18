/**
 * Common types for cron handlers
 */

import type { SQL } from 'drizzle-orm';

/**
 * Common database dependency interface for cron handlers
 */
export interface CronDbDeps {
  getDb: () => {
    execute: (sql: SQL) => Promise<{ rows: unknown[] }>;
  };
  sql: typeof import('drizzle-orm').sql;
}
