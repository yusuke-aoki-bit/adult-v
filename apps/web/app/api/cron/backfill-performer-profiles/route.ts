/**
 * 演者プロフィール自動補充 API エンドポイント
 *
 * GET /api/cron/backfill-performer-profiles?limit=100&minProducts=5
 *
 * SOKMIL Actor API を活用して演者の身体情報・誕生日・画像を補充
 */

import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { createBackfillPerformerProfilesHandler } from '@adult-v/shared/cron-handlers';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export const GET = createBackfillPerformerProfilesHandler({
  getDb,
  sql,
});
