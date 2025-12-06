/**
 * セール情報クローラー
 *
 * 各ASPのセールページからセール情報を取得し、product_salesテーブルに保存
 *
 * Usage:
 *   npx tsx scripts/crawlers/crawl-sales.ts [--asp MGS|DUGA|SOKMIL|all] [--limit N]
 */

import { getDb } from '../../lib/db';
import { sql } from 'drizzle-orm';
import * as cheerio from 'cheerio';
import {
  getFirstRow,
  IdRow,
  RateLimiter,
  crawlerLog,
  robustFetch,
} from '../../lib/crawler';

interface SaleItem {
  originalProductId: string;
  regularPrice: number;
  salePrice: number;
  discountPercent: number;
  saleName: string | null;
  saleType: string | null;
  endAt: Date | null;
}

const rateLimiter = new RateLimiter({ minDelayMs: 1500, maxDelayMs: 3000 });

/**
 * MGSのセールページからセール情報を取得
 */
async function crawlMgsSales(limit: number = 100): Promise<SaleItem[]> {
  const saleItems: SaleItem[] = [];

  // MGSのセールページURL（複数カテゴリ）
  const salePageUrls = [
    { url: 'https://www.mgstage.com/ppv/sale.php', type: 'campaign', name: 'セール' },
    { url: 'https://www.mgstage.com/ppv/timesale.php', type: 'timesale', name: 'タイムセール' },
    { url: 'https://www.mgstage.com/ppv/sale.php?sort=sale_price&genre=', type: 'campaign', name: 'セール（価格順）' },
  ];

  for (const pageInfo of salePageUrls) {
    if (saleItems.length >= limit) break;

    try {
      crawlerLog.info(`Fetching MGS sale page: ${pageInfo.url}`);
      await rateLimiter.wait();

      const response = await robustFetch(pageInfo.url, {
        init: {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Cookie': 'adc=1',
          },
        },
        timeoutMs: 30000,
        retry: { maxRetries: 3 },
      });

      rateLimiter.done();

      if (!response.ok) {
        crawlerLog.warn(`Failed to fetch: ${response.status}`);
        continue;
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // セール商品を抽出（複数セレクタに対応）
      const selectors = [
        '.search_list .data',
        '.rank_list .data',
        '.list_data',
        '.search_result .item',
        '.movie_list li',
      ];

      for (const selector of selectors) {
        $(selector).each((_, el) => {
          if (saleItems.length >= limit) return false;

          const $item = $(el);
          const link = $item.find('a[href*="/product_detail/"]').attr('href') ||
                       $item.find('a[href*="product_detail"]').attr('href');
          if (!link) return;

          // 商品IDを抽出
          const productIdMatch = link.match(/product_detail\/([^\/\?]+)/);
          if (!productIdMatch) return;
          const productId = productIdMatch[1];

          // 重複チェック
          if (saleItems.some(item => item.originalProductId === productId)) return;

          // 価格情報を抽出（複数パターン対応）
          const priceText = $item.find('.price, .price_num, .sale_price').first().text();
          const originalPriceText = $item.find('.price_off, .original_price, del, .normal_price').first().text();

          // 価格をパース
          const salePriceMatch = priceText.match(/[\d,]+/);
          if (!salePriceMatch) return;

          const salePrice = parseInt(salePriceMatch[0].replace(/,/g, ''));
          let regularPrice = salePrice;

          if (originalPriceText) {
            const originalPriceMatch = originalPriceText.match(/[\d,]+/);
            if (originalPriceMatch) {
              regularPrice = parseInt(originalPriceMatch[0].replace(/,/g, ''));
            }
          }

          if (salePrice >= regularPrice || regularPrice === 0) return;

          const discountPercent = Math.round((1 - salePrice / regularPrice) * 100);

          // セール終了日時を抽出
          let endAt: Date | null = null;
          const endTimeText = $item.find('.sale_end, .end_time, .limit_time').text();
          if (endTimeText) {
            const dateMatch = endTimeText.match(/(\d+)\/(\d+)/);
            if (dateMatch) {
              const now = new Date();
              const month = parseInt(dateMatch[1]);
              const day = parseInt(dateMatch[2]);
              endAt = new Date(now.getFullYear(), month - 1, day, 23, 59, 59);
              if (endAt < now) {
                endAt.setFullYear(now.getFullYear() + 1);
              }
            }
          }

          saleItems.push({
            originalProductId: productId,
            regularPrice,
            salePrice,
            discountPercent,
            saleName: pageInfo.name,
            saleType: pageInfo.type,
            endAt,
          });
        });
      }

      crawlerLog.success(`Found ${saleItems.length} sale items from ${pageInfo.name}`);

    } catch (error) {
      crawlerLog.error(`Error crawling ${pageInfo.url}:`, error);
    }
  }

  return saleItems;
}

/**
 * DUGAのセールページからセール情報を取得
 */
async function crawlDugaSales(limit: number = 100): Promise<SaleItem[]> {
  const saleItems: SaleItem[] = [];

  // DUGAのセールページURL（複数ページ）
  const salePageUrls = [
    { url: 'https://duga.jp/ppv/?sort=discount', name: 'DUGA割引' },
    { url: 'https://duga.jp/ppv/sale/', name: 'DUGAセール' },
  ];

  for (const pageInfo of salePageUrls) {
    if (saleItems.length >= limit) break;

    try {
      crawlerLog.info(`Fetching DUGA sale page: ${pageInfo.url}`);
      await rateLimiter.wait();

      const response = await robustFetch(pageInfo.url, {
        init: {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
          },
        },
        timeoutMs: 30000,
        retry: { maxRetries: 3 },
      });

      rateLimiter.done();

      if (!response.ok) {
        crawlerLog.warn(`Failed to fetch: ${response.status}`);
        continue;
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // セール商品を抽出
      const selectors = [
        '.contentslist li',
        '.itemlist .item',
        '.list_wrap .list',
        '.product_list article',
      ];

      for (const selector of selectors) {
        $(selector).each((_, el) => {
          if (saleItems.length >= limit) return false;

          const $item = $(el);
          const link = $item.find('a[href*="/ppv/"]').attr('href');
          if (!link) return;

          // 商品IDを抽出
          const productIdMatch = link.match(/\/ppv\/([^\/\?]+)/);
          if (!productIdMatch) return;
          const productId = productIdMatch[1];

          // 重複チェック
          if (saleItems.some(item => item.originalProductId === productId)) return;

          // 価格情報を抽出
          const priceText = $item.find('.price, .sale_price, .now_price').first().text();
          const originalPriceText = $item.find('.original_price, .list_price, del, s, .before_price').first().text();

          const salePriceMatch = priceText.match(/[\d,]+/);
          if (!salePriceMatch) return;

          const salePrice = parseInt(salePriceMatch[0].replace(/,/g, ''));
          let regularPrice = salePrice;

          if (originalPriceText) {
            const originalPriceMatch = originalPriceText.match(/[\d,]+/);
            if (originalPriceMatch) {
              regularPrice = parseInt(originalPriceMatch[0].replace(/,/g, ''));
            }
          }

          if (salePrice >= regularPrice || regularPrice === 0) return;

          const discountPercent = Math.round((1 - salePrice / regularPrice) * 100);

          // 割引率が5%未満は除外
          if (discountPercent < 5) return;

          saleItems.push({
            originalProductId: productId,
            regularPrice,
            salePrice,
            discountPercent,
            saleName: pageInfo.name,
            saleType: 'campaign',
            endAt: null,
          });
        });
      }

      crawlerLog.success(`Found ${saleItems.length} sale items from ${pageInfo.name}`);

    } catch (error) {
      crawlerLog.error(`Error crawling DUGA sales:`, error);
    }
  }

  return saleItems;
}

/**
 * SOKMILのセールページからセール情報を取得
 */
async function crawlSokmilSales(limit: number = 100): Promise<SaleItem[]> {
  const saleItems: SaleItem[] = [];

  // SOKMILのセールページURL
  const salePageUrls = [
    { url: 'https://www.sokmil.com/av/sale/', name: 'SOKMILセール' },
    { url: 'https://www.sokmil.com/av/timesale/', name: 'SOKMILタイムセール' },
    { url: 'https://www.sokmil.com/av/?sort=discount', name: 'SOKMIL割引順' },
  ];

  for (const pageInfo of salePageUrls) {
    if (saleItems.length >= limit) break;

    try {
      crawlerLog.info(`Fetching SOKMIL sale page: ${pageInfo.url}`);
      await rateLimiter.wait();

      const response = await robustFetch(pageInfo.url, {
        init: {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        },
        timeoutMs: 30000,
        retry: { maxRetries: 3 },
      });

      rateLimiter.done();

      if (!response.ok) {
        crawlerLog.warn(`Failed to fetch: ${response.status}`);
        continue;
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // セール商品を抽出
      const selectors = [
        '.item_list li',
        '.product_list .item',
        '.sale_list article',
        '.movie_list .movie_item',
      ];

      for (const selector of selectors) {
        $(selector).each((_, el) => {
          if (saleItems.length >= limit) return false;

          const $item = $(el);
          // SOKMILの商品リンクパターン
          const link = $item.find('a[href*="/av/"]').attr('href') ||
                       $item.find('a[href*="content_id="]').attr('href');
          if (!link) return;

          // 商品IDを抽出（複数パターン対応）
          let productId: string | null = null;
          const contentIdMatch = link.match(/content_id=([^&]+)/);
          if (contentIdMatch) {
            productId = contentIdMatch[1];
          } else {
            const pathMatch = link.match(/\/av\/([^\/\?]+)\/?$/);
            if (pathMatch) {
              productId = pathMatch[1];
            }
          }
          if (!productId) return;

          // 重複チェック
          if (saleItems.some(item => item.originalProductId === productId)) return;

          // 価格情報を抽出
          const priceText = $item.find('.price, .sale_price, .now_price').first().text();
          const originalPriceText = $item.find('.original_price, .list_price, del, s, .before_price').first().text();

          const salePriceMatch = priceText.match(/[\d,]+/);
          if (!salePriceMatch) return;

          const salePrice = parseInt(salePriceMatch[0].replace(/,/g, ''));
          let regularPrice = salePrice;

          if (originalPriceText) {
            const originalPriceMatch = originalPriceText.match(/[\d,]+/);
            if (originalPriceMatch) {
              regularPrice = parseInt(originalPriceMatch[0].replace(/,/g, ''));
            }
          }

          if (salePrice >= regularPrice || regularPrice === 0) return;

          const discountPercent = Math.round((1 - salePrice / regularPrice) * 100);

          // 割引率が5%未満は除外
          if (discountPercent < 5) return;

          // セール終了日時を抽出
          let endAt: Date | null = null;
          const endTimeText = $item.find('.sale_end, .end_time, .limit').text();
          if (endTimeText) {
            const dateMatch = endTimeText.match(/(\d+)\/(\d+)/);
            if (dateMatch) {
              const now = new Date();
              const month = parseInt(dateMatch[1]);
              const day = parseInt(dateMatch[2]);
              endAt = new Date(now.getFullYear(), month - 1, day, 23, 59, 59);
              if (endAt < now) {
                endAt.setFullYear(now.getFullYear() + 1);
              }
            }
          }

          saleItems.push({
            originalProductId: productId!,
            regularPrice,
            salePrice,
            discountPercent,
            saleName: pageInfo.name,
            saleType: pageInfo.url.includes('timesale') ? 'timesale' : 'campaign',
            endAt,
          });
        });
      }

      crawlerLog.success(`Found ${saleItems.length} sale items from ${pageInfo.name}`);

    } catch (error) {
      crawlerLog.error(`Error crawling SOKMIL sales:`, error);
    }
  }

  return saleItems;
}

/**
 * セール情報をDBに保存
 */
async function saveSaleItems(aspName: string, items: SaleItem[]): Promise<number> {
  const db = getDb();
  let savedCount = 0;

  for (const item of items) {
    try {
      // product_sourceを検索
      const sourceResult = await db.execute(sql`
        SELECT id FROM product_sources
        WHERE asp_name = ${aspName}
        AND original_product_id = ${item.originalProductId}
        LIMIT 1
      `);

      const sourceRow = getFirstRow<IdRow>(sourceResult);
      if (!sourceRow) {
        // 商品が未登録の場合はスキップ
        continue;
      }

      const productSourceId = sourceRow.id;

      // 既存のアクティブなセールを非アクティブに
      await db.execute(sql`
        UPDATE product_sales
        SET is_active = FALSE, updated_at = NOW()
        WHERE product_source_id = ${productSourceId}
        AND is_active = TRUE
      `);

      // 新しいセール情報を挿入
      await db.execute(sql`
        INSERT INTO product_sales (
          product_source_id,
          regular_price,
          sale_price,
          discount_percent,
          sale_name,
          sale_type,
          end_at,
          is_active,
          fetched_at
        ) VALUES (
          ${productSourceId},
          ${item.regularPrice},
          ${item.salePrice},
          ${item.discountPercent},
          ${item.saleName},
          ${item.saleType},
          ${item.endAt},
          TRUE,
          NOW()
        )
      `);

      savedCount++;
    } catch (error) {
      crawlerLog.error(`Error saving sale for ${item.originalProductId}:`, error);
    }
  }

  return savedCount;
}

/**
 * 期限切れのセールを非アクティブに
 */
async function deactivateExpiredSales(): Promise<number> {
  const db = getDb();

  const result = await db.execute(sql`
    UPDATE product_sales
    SET is_active = FALSE, updated_at = NOW()
    WHERE is_active = TRUE
    AND end_at IS NOT NULL
    AND end_at < NOW()
    RETURNING id
  `);

  return result.rows.length;
}

async function main() {
  const args = process.argv.slice(2);
  const aspIndex = args.indexOf('--asp');
  const limitIndex = args.indexOf('--limit');

  const targetAsp = aspIndex !== -1 ? args[aspIndex + 1]?.toUpperCase() : 'all';
  const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1]) : 100;

  console.log('========================================');
  console.log('🛒 セール情報クローラー');
  console.log('========================================');
  console.log(`Target ASP: ${targetAsp}`);
  console.log(`Limit: ${limit}`);
  console.log('========================================\n');

  const stats = {
    mgs: { crawled: 0, saved: 0 },
    duga: { crawled: 0, saved: 0 },
    sokmil: { crawled: 0, saved: 0 },
    expired: 0,
  };

  // 期限切れセールを非アクティブに
  stats.expired = await deactivateExpiredSales();
  crawlerLog.info(`Deactivated ${stats.expired} expired sales\n`);

  // MGS
  if (targetAsp === 'ALL' || targetAsp === 'MGS') {
    crawlerLog.info('Crawling MGS sales...');
    const mgsItems = await crawlMgsSales(limit);
    stats.mgs.crawled = mgsItems.length;
    stats.mgs.saved = await saveSaleItems('MGS', mgsItems);
    crawlerLog.success(`MGS: Saved ${stats.mgs.saved}/${stats.mgs.crawled}\n`);
  }

  // DUGA
  if (targetAsp === 'ALL' || targetAsp === 'DUGA') {
    crawlerLog.info('Crawling DUGA sales...');
    const dugaItems = await crawlDugaSales(limit);
    stats.duga.crawled = dugaItems.length;
    stats.duga.saved = await saveSaleItems('DUGA', dugaItems);
    crawlerLog.success(`DUGA: Saved ${stats.duga.saved}/${stats.duga.crawled}\n`);
  }

  // SOKMIL
  if (targetAsp === 'ALL' || targetAsp === 'SOKMIL') {
    crawlerLog.info('Crawling SOKMIL sales...');
    const sokmilItems = await crawlSokmilSales(limit);
    stats.sokmil.crawled = sokmilItems.length;
    stats.sokmil.saved = await saveSaleItems('SOKMIL', sokmilItems);
    crawlerLog.success(`SOKMIL: Saved ${stats.sokmil.saved}/${stats.sokmil.crawled}\n`);
  }

  // サマリー
  console.log('========================================');
  console.log('📊 Summary');
  console.log('========================================');
  console.log(`MGS: ${stats.mgs.saved}/${stats.mgs.crawled} saved`);
  console.log(`DUGA: ${stats.duga.saved}/${stats.duga.crawled} saved`);
  console.log(`SOKMIL: ${stats.sokmil.saved}/${stats.sokmil.crawled} saved`);
  console.log(`Expired: ${stats.expired} deactivated`);
  console.log('========================================\n');

  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
