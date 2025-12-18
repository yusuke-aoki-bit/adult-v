/**
 * MGS クローラー API エンドポイント
 *
 * Cloud Schedulerから定期的に呼び出される
 * GET /api/cron/crawl-mgs?page=1&limit=50
 */

import { verifyCronRequest, unauthorizedResponse } from '@/lib/cron-auth';
import { getDb } from '@/lib/db';
import { createCrawlMgsHandler } from '@adult-v/shared/cron-handlers';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export const GET = createCrawlMgsHandler({
  verifyCronRequest,
  unauthorizedResponse,
  getDb,
});
