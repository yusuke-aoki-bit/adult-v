/**
 * セール情報クローラー
 *
 * 各ASPのセールページからセール情報を取得し、product_salesテーブルに保存
 *
 * Usage:
 *   npx tsx scripts/crawlers/crawl-sales.ts [--asp MGS|DUGA|SOKMIL|all] [--limit N]
 */

import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';
import * as cheerio from 'cheerio';
import {
  getFirstRow,
  IdRow,
  RateLimiter,
  crawlerLog,
  robustFetch,
} from '../lib/crawler';
import { getDugaClient, DugaProduct } from '../lib/providers/duga-client';
import { getSokmilClient } from '../lib/providers/sokmil-client';

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
    { url: 'https://www.mgstage.com/search/cSearch.php?type=sale', type: 'campaign', name: 'セール' },
    { url: 'https://www.mgstage.com/search/cSearch.php?type=timesale', type: 'timesale', name: 'タイムセール' },
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
      // MGSの検索結果ページ構造: .search_list内の各商品
      const selectors = [
        '.search_list .data',      // 検索結果リスト
        '.rank_list li',           // ランキングリスト
        '.movie_list li',          // 動画リスト
        '.sale_container',         // セールコンテナ（親要素）
      ];

      // 商品リンクを直接検索
      $('a[href*="/product/product_detail/"]').each((_, el) => {
        if (saleItems.length >= limit) return false;

        const link = $(el).attr('href');
        if (!link) return;

        // 商品IDを抽出
        const productIdMatch = link.match(/product_detail\/([^\/\?]+)/);
        if (!productIdMatch) return;
        const productId = productIdMatch[1];

        // 重複チェック
        if (saleItems.some(item => item.originalProductId === productId)) return;

        // 親要素から価格情報を探す
        const $parent = $(el).closest('.search_list, .rank_list, li, article, .data').first();
        if ($parent.length === 0) return;

        // 価格情報を抽出（セール価格のみ取得可能）
        const priceText = $parent.find('.min-price, .price, .sale_price').first().text();

        // 価格をパース
        const salePriceMatch = priceText.match(/[\d,]+/);
        if (!salePriceMatch) return;

        const salePrice = parseInt(salePriceMatch[0].replace(/,/g, ''));
        if (salePrice <= 0) return;

        // セール終了日時を抽出
        let endAt: Date | null = null;
        const endTimeText = $parent.find('.sale_end, .end_time, .limit_time, .remaining').text();
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

        // 通常価格はDBから取得するため、ここではセール価格のみ記録
        // regularPriceは後でDB照合時に設定
        saleItems.push({
          originalProductId: productId,
          regularPrice: 0, // 後でDBから取得
          salePrice,
          discountPercent: 0, // 後で計算
          saleName: pageInfo.name,
          saleType: pageInfo.type,
          endAt,
        });
      });

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
    { url: 'https://duga.jp/search/=/campaignid=sale/', name: 'DUGAセール', type: 'campaign' },
    { url: 'https://duga.jp/search/=/sort=discount/', name: 'DUGA割引順', type: 'discount' },
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

      // セール商品を抽出 - DUGAの構造: .contentslist内の各商品
      // producthoverboxにpid属性、.moneyに価格
      $('.contentslist').each((_, el) => {
        if (saleItems.length >= limit) return false;

        const $item = $(el);
        const $hoverbox = $item.find('[pid]');
        if ($hoverbox.length === 0) return;

        const productId = $hoverbox.attr('pid');
        if (!productId) return;

        // 重複チェック
        if (saleItems.some(item => item.originalProductId === productId)) return;

        // 価格情報を抽出
        const priceText = $item.find('.money').text();
        const salePriceMatch = priceText.match(/[\d,]+/);
        if (!salePriceMatch) return;

        const salePrice = parseInt(salePriceMatch[0].replace(/,/g, ''));
        if (salePrice <= 0) return;

        // 通常価格はDBから取得
        saleItems.push({
          originalProductId: productId,
          regularPrice: 0, // 後でDBから取得
          salePrice,
          discountPercent: 0, // 後で計算
          saleName: pageInfo.name,
          saleType: pageInfo.type || 'campaign',
          endAt: null,
        });
      });

      // 代替セレクタ（従来のli構造も試す）
      $('a[href*="/ppv/"]').each((_, el) => {
        if (saleItems.length >= limit) return false;

        const link = $(el).attr('href');
        if (!link) return;

        // 商品IDを抽出
        const productIdMatch = link.match(/\/ppv\/([^\/\?]+)/);
        if (!productIdMatch) return;
        const productId = productIdMatch[1];

        // 重複チェック
        if (saleItems.some(item => item.originalProductId === productId)) return;

        // 価格情報を抽出
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
          saleType: pageInfo.type || 'campaign',
          endAt: null,
        });
      });

      crawlerLog.success(`Found ${saleItems.length} sale items from ${pageInfo.name}`);

    } catch (error) {
      crawlerLog.error(`Error crawling DUGA sales:`, error);
    }
  }

  return saleItems;
}

/**
 * SOKMILのセール情報をAPIから取得
 * APIでセール情報を直接取得できないため、価格安い順で取得して
 * listPriceとpriceを比較してセール品を検出
 */
async function crawlSokmilSales(limit: number = 100): Promise<SaleItem[]> {
  const saleItems: SaleItem[] = [];

  try {
    crawlerLog.info('Fetching SOKMIL sales via API...');
    const sokmilClient = getSokmilClient();

    // APIで価格安い順に取得（セール品が多い可能性）
    const response = await sokmilClient.searchItems({
      hits: Math.min(limit * 2, 100), // セール品を見つけるために多めに取得
      offset: 1,
      sort: '-price', // 価格安い順
    });

    if (response.status !== 'success') {
      crawlerLog.warn(`SOKMIL API error: ${response.error}`);
      return saleItems;
    }

    crawlerLog.info(`Fetched ${response.data.length} items from SOKMIL API`);

    // セール品を抽出（listPriceとpriceを比較）
    for (const item of response.data) {
      if (saleItems.length >= limit) break;

      // listPriceがあり、priceより高い場合はセール
      // 注意: APIでlistPriceが提供されない場合はセール検出不可
      const price = item.price || 0;
      const listPrice = (item as any).listPrice || 0; // APIレスポンスにlistPriceがあるか確認

      if (listPrice > 0 && price > 0 && listPrice > price) {
        const discountPercent = Math.round((1 - price / listPrice) * 100);

        // 5%以上の割引のみ
        if (discountPercent >= 5) {
          saleItems.push({
            originalProductId: item.itemId,
            regularPrice: listPrice,
            salePrice: price,
            discountPercent,
            saleName: 'SOKMILセール',
            saleType: 'campaign',
            endAt: null,
          });
        }
      }
    }

    crawlerLog.success(`Found ${saleItems.length} sale items from SOKMIL API`);

  } catch (error) {
    crawlerLog.error('Error crawling SOKMIL sales via API:', error);
  }

  return saleItems;
}

/**
 * DUGAの商品をAPIから取得してDBに自動登録
 */
async function registerDugaProduct(productId: string): Promise<number | null> {
  const db = getDb();

  try {
    const dugaClient = getDugaClient();
    const response = await dugaClient.searchProducts({
      keyword: productId,
      hits: 1,
    });

    if (response.items.length === 0) {
      crawlerLog.warn(`DUGA product not found via API: ${productId}`);
      return null;
    }

    const item = response.items[0];

    // 完全一致チェック
    if (item.productId !== productId) {
      crawlerLog.warn(`Product ID mismatch: expected ${productId}, got ${item.productId}`);
      return null;
    }

    // productsテーブルに挿入
    const normalizedProductId = `duga-${productId}`;
    const productResult = await db.execute(sql`
      INSERT INTO products (
        normalized_product_id,
        title,
        description,
        release_date,
        duration,
        default_thumbnail_url
      ) VALUES (
        ${normalizedProductId},
        ${item.title},
        ${item.description || null},
        ${item.releaseDate || null},
        ${item.duration || null},
        ${item.thumbnailUrl || null}
      )
      ON CONFLICT (normalized_product_id)
      DO UPDATE SET
        title = EXCLUDED.title,
        updated_at = NOW()
      RETURNING id
    `);

    const productRow = getFirstRow<IdRow>(productResult);
    if (!productRow) return null;

    // product_sourcesテーブルに挿入
    const sourceResult = await db.execute(sql`
      INSERT INTO product_sources (
        product_id,
        asp_name,
        original_product_id,
        affiliate_url,
        price,
        data_source
      ) VALUES (
        ${productRow.id},
        'DUGA',
        ${productId},
        ${item.affiliateUrl},
        ${item.price || null},
        'API'
      )
      ON CONFLICT (product_id, asp_name)
      DO UPDATE SET
        affiliate_url = EXCLUDED.affiliate_url,
        price = EXCLUDED.price,
        last_updated = NOW()
      RETURNING id
    `);

    const sourceRow = getFirstRow<IdRow>(sourceResult);
    crawlerLog.success(`Auto-registered DUGA product: ${productId} (source_id: ${sourceRow?.id})`);

    return sourceRow?.id || null;
  } catch (error) {
    crawlerLog.error(`Failed to register DUGA product ${productId}:`, error);
    return null;
  }
}

/**
 * セール情報をDBに保存
 * regularPriceが0の場合はDBから既存の価格を取得して比較
 * DBにない商品の場合はAPIから自動登録を試みる
 */
async function saveSaleItems(aspName: string, items: SaleItem[]): Promise<number> {
  const db = getDb();
  let savedCount = 0;

  for (const item of items) {
    try {
      // product_sourceを検索（価格も含めて取得）
      const sourceResult = await db.execute(sql`
        SELECT id, price FROM product_sources
        WHERE asp_name = ${aspName}
        AND original_product_id = ${item.originalProductId}
        LIMIT 1
      `);

      let sourceRow = sourceResult.rows[0] as { id: number; price: number | null } | undefined;

      // 商品が未登録の場合、DUGAの場合はAPIから自動登録を試みる
      if (!sourceRow) {
        if (aspName === 'DUGA') {
          crawlerLog.info(`Product not found in DB, attempting auto-registration: ${item.originalProductId}`);
          const registeredSourceId = await registerDugaProduct(item.originalProductId);
          if (registeredSourceId) {
            // 登録成功した場合、価格を再取得
            const reResult = await db.execute(sql`
              SELECT id, price FROM product_sources
              WHERE id = ${registeredSourceId}
              LIMIT 1
            `);
            sourceRow = reResult.rows[0] as { id: number; price: number | null } | undefined;
          }
        }

        if (!sourceRow) {
          crawlerLog.warn(`Skipping sale (product not registered): ${item.originalProductId}`);
          continue;
        }
      }

      const productSourceId = sourceRow.id;

      // regularPriceが0の場合、DBから取得
      let regularPrice = item.regularPrice;
      if (regularPrice === 0 && sourceRow.price) {
        regularPrice = sourceRow.price;
      }

      // 通常価格が取得できない、またはセール価格と同じ/高い場合はスキップ
      if (regularPrice === 0 || item.salePrice >= regularPrice) {
        continue;
      }

      // 割引率を計算
      const discountPercent = item.discountPercent || Math.round((1 - item.salePrice / regularPrice) * 100);

      // 割引率が5%未満はスキップ
      if (discountPercent < 5) {
        continue;
      }

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
          ${regularPrice},
          ${item.salePrice},
          ${discountPercent},
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
