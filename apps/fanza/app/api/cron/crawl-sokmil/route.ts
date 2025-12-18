/**
 * Sokmil クローラー API エンドポイント
 *
 * Cloud Schedulerから定期的に呼び出される
 * GET /api/cron/crawl-sokmil
 */

import { verifyCronRequest, unauthorizedResponse } from '@/lib/cron-auth';
import { getSokmilClient } from '@/lib/providers/sokmil-client';
import { getDb } from '@/lib/db';
import { createCrawlSokmilHandler } from '@adult-v/shared/cron-handlers';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export const GET = createCrawlSokmilHandler({
  verifyCronRequest,
  unauthorizedResponse,
  getDb,
  getSokmilClient,
});
