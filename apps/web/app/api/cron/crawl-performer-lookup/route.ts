/**
 * Performer Lookup 一括クロール API
 *
 * 各検索ソースをクロールして商品番号→女優名のマッピングを作成
 * GET /api/cron/crawl-performer-lookup?source=nakiny&page=1
 *
 * 対応ソース:
 * - minnano-av: みんなのAV（最新作品一覧から）
 * - av-wiki: AV-Wiki（品番インデックスから）
 * - nakiny: nakiny.com（素人系女優DB）
 * - av-sommelier: AVソムリエ
 * - shirouto-matome: 素人系まとめ
 * - seesaawiki: Seesaa Wiki
 */

import { verifyCronRequest, unauthorizedResponse } from '@/lib/cron-auth';
import { getDb } from '@/lib/db';
import { createCrawlPerformerLookupHandler } from '@adult-v/shared/cron-handlers';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export const GET = createCrawlPerformerLookupHandler({
  verifyCronRequest,
  unauthorizedResponse,
  getDb,
});
