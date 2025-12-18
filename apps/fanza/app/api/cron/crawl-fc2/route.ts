/**
 * FC2 クローラー API エンドポイント
 *
 * Cloud Schedulerから定期的に呼び出される
 * GET /api/cron/crawl-fc2
 */

import { verifyCronRequest, unauthorizedResponse } from '@/lib/cron-auth';
import { getDb } from '@/lib/db';
import { createCrawlFc2Handler } from '@adult-v/shared/cron-handlers';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export const GET = createCrawlFc2Handler({
  verifyCronRequest,
  unauthorizedResponse,
  getDb,
});
