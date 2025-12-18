/**
 * DUGA クローラー API エンドポイント
 *
 * Cloud Schedulerから定期的に呼び出される
 * GET /api/cron/crawl-duga
 */

import { verifyCronRequest, unauthorizedResponse } from '@/lib/cron-auth';
import { getDugaClient } from '@/lib/providers/duga-client';
import { getDb } from '@/lib/db';
import { createCrawlDugaHandler } from '@adult-v/shared/cron-handlers';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export const GET = createCrawlDugaHandler({
  verifyCronRequest,
  unauthorizedResponse,
  getDb,
  getDugaClient,
});
