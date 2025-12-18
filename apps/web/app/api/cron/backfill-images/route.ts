/**
 * 画像バックフィル API エンドポイント
 *
 * サムネイル画像がない商品に対して、各ASPサイトから画像を取得
 * GET /api/cron/backfill-images?limit=50&asp=MGS
 */

import { verifyCronRequest, unauthorizedResponse } from '@/lib/cron-auth';
import { getDb } from '@/lib/db';
import { createBackfillImagesHandler } from '@adult-v/shared/cron-handlers';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export const GET = createBackfillImagesHandler({
  verifyCronRequest,
  unauthorizedResponse,
  getDb,
});
