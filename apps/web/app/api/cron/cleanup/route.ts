/**
 * データクリーンアップ API エンドポイント
 *
 * Uses shared handler with dependency injection for DB operations
 */

import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { createCleanupHandler } from '@adult-v/shared/cron-handlers';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export const GET = createCleanupHandler({
  getDb,
  sql,
});
