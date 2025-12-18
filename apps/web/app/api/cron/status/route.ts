/**
 * クローラーステータス確認 API エンドポイント
 *
 * Uses shared handler with dependency injection for DB operations
 */

import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { createStatusHandler } from '@adult-v/shared/cron-handlers';

export const dynamic = 'force-dynamic';

export const GET = createStatusHandler({
  getDb,
  sql,
});
