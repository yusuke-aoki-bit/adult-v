/**
 * DTI クローラー API エンドポイント
 *
 * Cloud Schedulerから定期的に呼び出される
 * DTI系サイト（カリビアンコム、一本道、HEYZO等）をクロール
 * GET /api/cron/crawl-dti?site=1pondo&start=112024_001&limit=50
 */

import { verifyCronRequest, unauthorizedResponse } from '@/lib/cron-auth';
import { getDb } from '@/lib/db';
import { createCrawlDtiHandler } from '@adult-v/shared/cron-handlers';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export const GET = createCrawlDtiHandler({
  verifyCronRequest,
  unauthorizedResponse,
  getDb,
});
