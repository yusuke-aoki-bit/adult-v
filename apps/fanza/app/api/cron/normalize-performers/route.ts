/**
 * Wiki出演者名寄せ Cron API エンドポイント
 *
 * Cloud Schedulerから定期的に呼び出される
 * 出演者情報がない商品の品番をWikiで検索し、出演者情報を取得・紐付け
 *
 * GET /api/cron/normalize-performers?asp=MGS&limit=50&offset=0
 */

import { verifyCronRequest, unauthorizedResponse } from '@/lib/cron-auth';
import { getDb } from '@/lib/db';
import { createNormalizePerformersHandler } from '@adult-v/shared/cron-handlers';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export const GET = createNormalizePerformersHandler({
  verifyCronRequest,
  unauthorizedResponse,
  getDb,
});
