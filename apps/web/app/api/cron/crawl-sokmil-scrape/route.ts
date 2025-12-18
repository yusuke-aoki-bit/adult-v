/**
 * Sokmil スクレイピング クローラー API エンドポイント
 *
 * APIがダウンしている場合の代替としてWebサイトをスクレイピング
 * GET /api/cron/crawl-sokmil-scrape?page=1&limit=50
 */

import { verifyCronRequest, unauthorizedResponse } from '@/lib/cron-auth';
import { getDb } from '@/lib/db';
import { createCrawlSokmilScrapeHandler } from '@adult-v/shared/cron-handlers';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export const GET = createCrawlSokmilScrapeHandler({
  verifyCronRequest,
  unauthorizedResponse,
  getDb,
});
