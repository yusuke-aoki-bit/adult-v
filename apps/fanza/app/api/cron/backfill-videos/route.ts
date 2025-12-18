/**
 * 動画バックフィル API エンドポイント
 *
 * サンプル動画がない商品に対して、各ASPサイトから動画URLを取得
 * GET /api/cron/backfill-videos?limit=50&asp=MGS
 */

import { verifyCronRequest, unauthorizedResponse } from '@/lib/cron-auth';
import { getDb } from '@/lib/db';
import { createBackfillVideosHandler } from '@adult-v/shared/cron-handlers';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export const GET = createBackfillVideosHandler({
  verifyCronRequest,
  unauthorizedResponse,
  getDb,
});
