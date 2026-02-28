/**
 * セール情報クローラー ハンドラー
 *
 * 各ASPのセールページからセール情報を取得し、product_salesテーブルに保存
 * 旧 packages/crawlers/src/enrichment/crawl-sales.ts のWeb App API版（Puppeteer不使用）
 *
 * 対応ASP:
 * - MGS: セールページ/タイムセールページをcheerioでスクレイピング
 * - DUGA: セールページ/割引順ページをcheerioでスクレイピング
 * - SOKMIL: APIで価格取得→DB価格と比較してセール検出
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import * as cheerio from 'cheerio';
import { crawlerFetch } from '../lib/crawler-fetch';
import type { DbExecutor } from '../db-queries/types';
import { createSaleHelperQueries } from '../db-queries/sale-helper';
import type { SokmilApiClient } from '../providers/sokmil-client';

interface SaleItem {
  originalProductId: string;
  regularPrice: number;
  salePrice: number;
  discountPercent: number;
  saleName: string | null;
  saleType: string | null;
  endAt: Date | null;
}

interface CrawlSalesStats {
  mgs: { crawled: number; saved: number };
  duga: { crawled: number; saved: number };
  sokmil: { crawled: number; saved: number };
  errors: number;
}

const FETCH_TIMEOUT = 20_000;
const RATE_LIMIT_MS = 2000;

const FETCH_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

function fetchWithTimeout(url: string, headers?: Record<string, string>): Promise<Response> {
  return crawlerFetch(url, { headers: { ...FETCH_HEADERS, ...headers }, timeout: FETCH_TIMEOUT });
}

async function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms + Math.random() * 1000));
}

// =============================================================================
// MGS セールページクロール
// =============================================================================

async function crawlMgsSales(limit: number): Promise<SaleItem[]> {
  const saleItems: SaleItem[] = [];
  const salePages = [
    { url: 'https://www.mgstage.com/search/cSearch.php?type=sale', type: 'campaign', name: 'セール' },
    { url: 'https://www.mgstage.com/search/cSearch.php?type=timesale', type: 'timesale', name: 'タイムセール' },
  ];

  for (const pageInfo of salePages) {
    if (saleItems.length >= limit) break;

    try {
      console.log(`[crawl-sales] MGS: Fetching ${pageInfo.name}...`);
      const response = await fetchWithTimeout(pageInfo.url, { Cookie: 'adc=1' });
      if (!response.ok) {
        console.warn(`[crawl-sales] MGS: Failed to fetch ${pageInfo.name}: ${response.status}`);
        continue;
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      $('a[href*="/product/product_detail/"]').each((_, el) => {
        if (saleItems.length >= limit) return false;

        const link = $(el).attr('href');
        if (!link) return;

        const productIdMatch = link.match(/product_detail\/([^\/\?]+)/);
        if (!productIdMatch?.[1]) return;
        const productId = productIdMatch[1];

        if (saleItems.some((item) => item.originalProductId === productId)) return;

        const $parent = $(el).closest('.search_list, .rank_list, li, article, .data').first();
        if ($parent.length === 0) return;

        const priceText = $parent.find('.min-price, .price, .sale_price').first().text();
        const salePriceMatch = priceText.match(/[\d,]+/);
        if (!salePriceMatch) return;

        const salePrice = parseInt(salePriceMatch[0].replace(/,/g, ''));
        if (salePrice <= 0) return;

        // セール終了日時
        let endAt: Date | null = null;
        const endTimeText = $parent.find('.sale_end, .end_time, .limit_time, .remaining').text();
        if (endTimeText) {
          const dateMatch = endTimeText.match(/(\d+)\/(\d+)/);
          if (dateMatch?.[1] && dateMatch[2]) {
            const now = new Date();
            const month = parseInt(dateMatch[1], 10);
            const day = parseInt(dateMatch[2], 10);
            endAt = new Date(now.getFullYear(), month - 1, day, 23, 59, 59);
            if (endAt < now) endAt.setFullYear(now.getFullYear() + 1);
          }
        }

        saleItems.push({
          originalProductId: productId,
          regularPrice: 0, // DBから取得
          salePrice,
          discountPercent: 0,
          saleName: pageInfo.name,
          saleType: pageInfo.type,
          endAt,
        });
      });

      console.log(`[crawl-sales] MGS: Found ${saleItems.length} items from ${pageInfo.name}`);
      await delay(RATE_LIMIT_MS);
    } catch (error) {
      console.error(`[crawl-sales] MGS error:`, error);
    }
  }

  return saleItems;
}

// =============================================================================
// DUGA セールページクロール
// =============================================================================

async function crawlDugaSales(limit: number): Promise<SaleItem[]> {
  const saleItems: SaleItem[] = [];
  const salePages = [
    { url: 'https://duga.jp/search/=/campaignid=sale/', name: 'DUGAセール', type: 'campaign' },
    { url: 'https://duga.jp/search/=/sort=discount/', name: 'DUGA割引順', type: 'discount' },
  ];

  for (const pageInfo of salePages) {
    if (saleItems.length >= limit) break;

    try {
      console.log(`[crawl-sales] DUGA: Fetching ${pageInfo.name}...`);
      const response = await fetchWithTimeout(pageInfo.url);
      if (!response.ok) {
        console.warn(`[crawl-sales] DUGA: Failed to fetch ${pageInfo.name}: ${response.status}`);
        continue;
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // プライマリ: .contentslist + pid属性
      $('.contentslist').each((_, el) => {
        if (saleItems.length >= limit) return false;

        const $item = $(el);
        const $hoverbox = $item.find('[pid]');
        if ($hoverbox.length === 0) return;

        const productId = $hoverbox.attr('pid');
        if (!productId) return;
        if (saleItems.some((item) => item.originalProductId === productId)) return;

        const priceText = $item.find('.money').text();
        const salePriceMatch = priceText.match(/[\d,]+/);
        if (!salePriceMatch) return;

        const salePrice = parseInt(salePriceMatch[0].replace(/,/g, ''));
        if (salePrice <= 0) return;

        saleItems.push({
          originalProductId: productId,
          regularPrice: 0,
          salePrice,
          discountPercent: 0,
          saleName: pageInfo.name,
          saleType: pageInfo.type,
          endAt: null,
        });
      });

      // フォールバック: a[href*="/ppv/"]
      $('a[href*="/ppv/"]').each((_, el) => {
        if (saleItems.length >= limit) return false;

        const link = $(el).attr('href');
        if (!link) return;

        const productIdMatch = link.match(/\/ppv\/([^\/\?]+)/);
        if (!productIdMatch?.[1]) return;
        const productId = productIdMatch[1];
        if (saleItems.some((item) => item.originalProductId === productId)) return;

        const $parent = $(el).closest('.contentslist, li, article');
        const priceText = $parent.find('.money, .price').first().text();
        const salePriceMatch = priceText.match(/[\d,]+/);
        if (!salePriceMatch) return;

        const salePrice = parseInt(salePriceMatch[0].replace(/,/g, ''));
        if (salePrice <= 0) return;

        saleItems.push({
          originalProductId: productId,
          regularPrice: 0,
          salePrice,
          discountPercent: 0,
          saleName: pageInfo.name,
          saleType: pageInfo.type,
          endAt: null,
        });
      });

      console.log(`[crawl-sales] DUGA: Found ${saleItems.length} items from ${pageInfo.name}`);
      await delay(RATE_LIMIT_MS);
    } catch (error) {
      console.error(`[crawl-sales] DUGA error:`, error);
    }
  }

  return saleItems;
}

// =============================================================================
// SOKMIL API経由セール検出
// =============================================================================

async function crawlSokmilSales(sokmilClient: SokmilApiClient, db: DbExecutor, limit: number): Promise<SaleItem[]> {
  const saleItems: SaleItem[] = [];

  try {
    console.log(`[crawl-sales] SOKMIL: Fetching via API...`);
    const response = await sokmilClient.searchItems({
      hits: Math.min(limit * 2, 100),
      offset: 1,
      sort: '-price',
    });

    if (!response.data || response.data.length === 0) {
      console.warn(`[crawl-sales] SOKMIL: No items returned from API`);
      return saleItems;
    }

    console.log(`[crawl-sales] SOKMIL: Fetched ${response.data.length} items`);

    // APIの価格をDB内の通常価格と比較してセール品を検出
    const itemIds = response.data.filter((item) => item.itemId && item.price).map((item) => item.itemId);

    if (itemIds.length === 0) return saleItems;

    // DB内の通常価格を一括取得
    const idValues = sql.join(
      itemIds.map((id) => sql`${id}`),
      sql`, `,
    );
    const dbPrices = await db.execute(sql`
      SELECT original_product_id, price
      FROM product_sources
      WHERE asp_name = 'SOKMIL' AND original_product_id IN (${idValues})
      AND price IS NOT NULL AND price > 0
    `);

    const priceMap = new Map(
      (dbPrices.rows as { original_product_id: string; price: number }[]).map((r) => [r.original_product_id, r.price]),
    );

    for (const item of response.data) {
      if (saleItems.length >= limit) break;
      if (!item.itemId || !item.price) continue;

      const dbPrice = priceMap.get(item.itemId);
      if (!dbPrice || dbPrice <= item.price) continue;

      const discountPercent = Math.round((1 - item.price / dbPrice) * 100);
      if (discountPercent < 5) continue;

      saleItems.push({
        originalProductId: item.itemId,
        regularPrice: dbPrice,
        salePrice: item.price,
        discountPercent,
        saleName: 'SOKMILセール',
        saleType: 'campaign',
        endAt: null,
      });
    }

    console.log(`[crawl-sales] SOKMIL: Detected ${saleItems.length} sale items`);
  } catch (error) {
    console.error(`[crawl-sales] SOKMIL error:`, error);
  }

  return saleItems;
}

// =============================================================================
// セールアイテム保存（共通）
// =============================================================================

async function saveSaleItems(
  aspName: string,
  items: SaleItem[],
  db: DbExecutor,
  saleHelper: ReturnType<typeof createSaleHelperQueries>,
): Promise<number> {
  let savedCount = 0;

  for (const item of items) {
    try {
      // regularPrice=0の場合、DBから取得
      let { regularPrice } = item;
      if (regularPrice === 0) {
        const sourceResult = await db.execute(sql`
          SELECT price FROM product_sources
          WHERE asp_name = ${aspName} AND original_product_id = ${item.originalProductId}
          AND price IS NOT NULL AND price > 0
          LIMIT 1
        `);
        const row = sourceResult.rows[0] as { price: number } | undefined;
        if (row) regularPrice = row.price;
      }

      if (regularPrice === 0 || item.salePrice >= regularPrice) continue;

      const discountPercent = item.discountPercent || Math.round((1 - item.salePrice / regularPrice) * 100);
      if (discountPercent < 5) continue;

      const saved = await saleHelper.saveSaleInfo(aspName, item.originalProductId, {
        regularPrice,
        salePrice: item.salePrice,
        discountPercent,
        saleName: item.saleName ?? undefined,
        saleType: item.saleType ?? undefined,
        endAt: item.endAt,
      });
      if (saved) savedCount++;
    } catch (error) {
      console.error(`[crawl-sales] Error saving ${aspName} ${item.originalProductId}:`, error);
    }
  }

  return savedCount;
}

// =============================================================================
// メインハンドラー
// =============================================================================

export interface CrawlSalesHandlerDeps {
  verifyCronRequest: (request: NextRequest) => boolean;
  unauthorizedResponse: () => NextResponse;
  getDb: () => DbExecutor;
  getSokmilClient: () => SokmilApiClient;
}

export function createCrawlSalesHandler(deps: CrawlSalesHandlerDeps) {
  return async function GET(request: NextRequest) {
    if (!deps.verifyCronRequest(request)) {
      return deps.unauthorizedResponse();
    }

    const db = deps.getDb();
    const startTime = Date.now();
    const TIME_LIMIT = 150_000;
    const saleHelper = createSaleHelperQueries({ getDb: deps.getDb });

    const url = new URL(request['url']);
    const targetAsp = (url.searchParams.get('asp') || 'all').toUpperCase();
    const limit = parseInt(url.searchParams.get('limit') || '100');

    const stats: CrawlSalesStats = {
      mgs: { crawled: 0, saved: 0 },
      duga: { crawled: 0, saved: 0 },
      sokmil: { crawled: 0, saved: 0 },
      errors: 0,
    };

    try {
      // 期限切れセールの非アクティブ化
      const expired = await saleHelper.deactivateExpiredSales();
      if (expired > 0) {
        console.log(`[crawl-sales] Deactivated ${expired} expired sales`);
      }

      // MGS
      if ((targetAsp === 'ALL' || targetAsp === 'MGS') && Date.now() - startTime < TIME_LIMIT) {
        try {
          const items = await crawlMgsSales(limit);
          stats.mgs.crawled = items.length;
          stats.mgs.saved = await saveSaleItems('MGS', items, db, saleHelper);
          console.log(`[crawl-sales] MGS: ${stats.mgs.crawled} crawled, ${stats.mgs.saved} saved`);
        } catch (error) {
          stats.errors++;
          console.error('[crawl-sales] MGS failed:', error);
        }
      }

      // DUGA
      if ((targetAsp === 'ALL' || targetAsp === 'DUGA') && Date.now() - startTime < TIME_LIMIT) {
        try {
          const items = await crawlDugaSales(limit);
          stats.duga.crawled = items.length;
          stats.duga.saved = await saveSaleItems('DUGA', items, db, saleHelper);
          console.log(`[crawl-sales] DUGA: ${stats.duga.crawled} crawled, ${stats.duga.saved} saved`);
        } catch (error) {
          stats.errors++;
          console.error('[crawl-sales] DUGA failed:', error);
        }
      }

      // SOKMIL
      if ((targetAsp === 'ALL' || targetAsp === 'SOKMIL') && Date.now() - startTime < TIME_LIMIT) {
        try {
          const sokmilClient = deps.getSokmilClient();
          const items = await crawlSokmilSales(sokmilClient, db, limit);
          stats.sokmil.crawled = items.length;
          stats.sokmil.saved = await saveSaleItems('SOKMIL', items, db, saleHelper);
          console.log(`[crawl-sales] SOKMIL: ${stats.sokmil.crawled} crawled, ${stats.sokmil.saved} saved`);
        } catch (error) {
          stats.errors++;
          console.error('[crawl-sales] SOKMIL failed:', error);
        }
      }

      const duration = Math.round((Date.now() - startTime) / 1000);
      const totalSaved = stats.mgs.saved + stats.duga.saved + stats.sokmil.saved;

      return NextResponse.json({
        success: true,
        message: `Sale crawl completed: ${totalSaved} sales saved`,
        stats,
        duration: `${duration}s`,
      });
    } catch (error) {
      console.error('[crawl-sales] Error:', error);
      return NextResponse.json(
        { success: false, error: error instanceof Error ? error.message : 'Unknown error', stats },
        { status: 500 },
      );
    }
  };
}
