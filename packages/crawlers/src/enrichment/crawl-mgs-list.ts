/**
 * MGS動画一覧ページクローラー
 *
 * 機能:
 * - MGS動画の新着一覧ページから商品URLを取得
 * - 各商品ページをcrawl-mgs.tsと同じロジックでクロール
 * - 重複チェック付きでデータベースに保存
 * - フルスキャンモード: シリーズ検索で全商品を取得
 *
 * 使い方:
 * npx tsx packages/crawlers/src/enrichment/crawl-mgs-list.ts [--limit 100] [--pages 10] [--start-page=1] [--no-ai]
 * npx tsx packages/crawlers/src/enrichment/crawl-mgs-list.ts --full-scan [--series=STARS] [--no-ai]
 */

import * as cheerio from 'cheerio';
import crypto from 'crypto';
import { getDb } from '../lib/db';
import { rawHtmlData, productSources, products, performers, productPerformers, tags, productTags, productImages, productVideos, productReviews, productRatingSummary } from '../lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { isValidPerformerName, normalizePerformerName, isValidPerformerForProduct } from '../lib/performer-validation';
import { validateProductData, isTopPageHtml } from '../lib/crawler-utils';
import { getAIHelper } from '../lib/crawler';
import type { GeneratedDescription } from '../lib/google-apis';
import { saveRawHtml, calculateHash } from '../lib/gcs-crawler-helper';
import { saveSaleInfo, SaleInfo } from '../lib/sale-helper';

const AFFILIATE_CODE = '6CS5PGEBQDUYPZLHYEM33TBZFJ';
const SOURCE_NAME = 'MGS';
const BASE_URL = 'https://www.mgstage.com';
const ITEMS_PER_PAGE = 120;

// MGS主要シリーズ一覧（全商品を網羅するためのキーワード検索用）
// これらのシリーズプレフィックスで検索することで、新着順だけでなく過去の商品も取得
const MGS_SERIES_PREFIXES = [
  // プレステージ
  'ABW', 'ABP', 'ABS', 'ABF', 'CHN', 'TEM', 'SGA', 'SABA', 'KBI', 'GAV',
  'AOI', 'EDD', 'YRH', 'SRS', 'MBM', 'FIV', 'BXH', 'RDT', 'MAN', 'MGT',
  // SODクリエイト
  'STARS', 'SDAB', 'SDJS', 'SDDE', 'SDAM', 'SDMU', 'SDNT', 'SDNM', 'SDEN',
  'SDMF', 'SDMM', 'JUFE', 'JUSD', 'JUNY',
  // kawaii
  'CAWD', 'KAVR', 'KWBD', 'KAWD',
  // ムーディーズ
  'MIAA', 'MIDE', 'MIRD', 'MIDD', 'MIMK', 'PRED', 'PPPD', 'SNIS', 'SSNI',
  // S1
  'SSIS', 'SONE', 'SIVR', 'OFJE', 'SOE', 'MSFH',
  // アイデアポケット
  'IPX', 'IPZ', 'IPVR', 'SUPD', 'HODV',
  // 素人系
  '261ARA', '259LUXU', '300MIUM', '300MAAN', '300NTK', '300ORETD', '261SIRO',
  '230OREC', '230ORETV', '390JAC', '336KNB', '200GANA', '320MMGH', '345SIMM',
  // FALENOstar
  'FSDSS', 'FLNS', 'MFCS', 'FADSS',
  // その他人気
  'GVH', 'JUL', 'ROE', 'MOND', 'MEYD', 'ENGSUB',
];

// 日付ソートオプション（古い順、新しい順）
type SortOrder = 'new' | 'old' | 'popular';

// MGSカテゴリ設定（動画配信、DVD、月額チャンネル）
const MGS_CATEGORIES = [
  { name: '動画配信', type: 'haishin', url: 'https://www.mgstage.com/search/cSearch.php?sort=new&list_cnt=120&type=haishin' },
  { name: 'DVD', type: 'dvd', url: 'https://www.mgstage.com/ppv/dvd/' },
];

// 月額チャンネル設定
const MGS_MONTHLY_CHANNELS = [
  { name: 'S1ch', shopId: 'superch' },
  { name: 'DOCch', shopId: 'docch' },
  { name: 'プレステージBB', shopId: 'prestigebb' },
  { name: 'かんぱにBB', shopId: 'kanbich' },
  { name: 'SODch', shopId: 'sodch' },
  { name: 'HMPch', shopId: 'hmpbb' },
  { name: 'HOTch', shopId: 'hotbb' },
  { name: 'NEXTch', shopId: 'nextbb' },
];

interface CrawlStats {
  totalFetched: number;
  newProducts: number;
  updatedProducts: number;
  skippedUnchanged: number;
  errors: number;
}

// 並列処理の設定
const CONCURRENCY = 5; // 同時実行数
const BATCH_DELAY_MS = 200; // バッチ間の待機時間

/**
 * 配列をチャンクに分割
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// MGS商品タイプ
type MgsProductType = 'haishin' | 'dvd' | 'monthly';

interface CrawlResult {
  success: boolean;
  isNew: boolean;
  isUpdated: boolean;
  isSkipped: boolean;
  error?: string;
}

/**
 * 単一商品をクロール（並列処理用）
 */
async function crawlSingleProduct(
  url: string,
  productType: MgsProductType,
  enableAI: boolean,
): Promise<CrawlResult> {
  const productIdMatch = url.match(/product_detail\/([^\/]+)/);
  const productId = productIdMatch ? productIdMatch[1] : 'unknown';

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cookie': 'adc=1',
      },
    });

    if (!response.ok) {
      return { success: false, isNew: false, isUpdated: false, isSkipped: false, error: `HTTP ${response['status']}` };
    }

    const html = await response['text']();
    const mgsProduct = parseMgsProductPage(html, url);

    if (!mgsProduct) {
      return { success: false, isNew: false, isUpdated: false, isSkipped: false, error: 'Failed to parse' };
    }

    mgsProduct.productType = productType;

    // saveProductの結果を取得するためにstatsオブジェクトを使用
    const stats: CrawlStats = {
      totalFetched: 0,
      newProducts: 0,
      updatedProducts: 0,
      skippedUnchanged: 0,
      errors: 0,
    };

    await saveProduct(mgsProduct, html, enableAI, stats);

    return {
      success: stats.errors === 0,
      isNew: stats.newProducts > 0,
      isUpdated: stats.updatedProducts > 0,
      isSkipped: stats.skippedUnchanged > 0,
    };

  } catch (error) {
    return { success: false, isNew: false, isUpdated: false, isSkipped: false, error: String(error) };
  }
}

/**
 * 並列でバッチ処理
 */
async function processBatchParallel(
  urls: string[],
  productType: MgsProductType,
  enableAI: boolean,
  stats: CrawlStats,
  startIndex: number,
  totalCount: number,
): Promise<void> {
  const chunks = chunkArray(urls, CONCURRENCY);

  for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
    const chunk = chunks[chunkIdx];
    if (!chunk) continue;
    const chunkStartIdx = startIndex + chunkIdx * CONCURRENCY;

    // 並列実行
    const results = await Promise.all(
      chunk.map(async (url, idx) => {
        const globalIdx = chunkStartIdx + idx + 1;
        const productIdMatch = url.match(/product_detail\/([^\/]+)/);
        const productId = productIdMatch?.[1] ?? 'unknown';

        const result = await crawlSingleProduct(url, productType, enableAI);

        // 結果をログ出力
        if (result.success) {
          if (result.isNew) {
            console.log(`  [${globalIdx}/${totalCount}] ${productId} ✓ New`);
          } else if (result.isUpdated) {
            console.log(`  [${globalIdx}/${totalCount}] ${productId} ✓ Updated`);
          } else if (result.isSkipped) {
            console.log(`  [${globalIdx}/${totalCount}] ${productId} ⏭️ Skipped`);
          }
        } else {
          console.log(`  [${globalIdx}/${totalCount}] ${productId} ⚠️ ${result.error}`);
        }

        return result;
      })
    );

    // 統計を集計
    for (const result of results) {
      stats.totalFetched++;
      if (result.isNew) stats.newProducts++;
      if (result.isUpdated) stats.updatedProducts++;
      if (result.isSkipped) stats.skippedUnchanged++;
      if (!result.success) stats.errors++;
    }

    // バッチ間の待機（レート制限）
    if (chunkIdx < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }
}

interface MgsProduct {
  productId: string;
  url: string;
  title: string;
  releaseDate?: string;
  performerNames?: string[];
  thumbnailUrl?: string;
  sampleImages?: string[];
  sampleVideoUrl?: string;
  price?: number;
  saleInfo?: SaleInfo;
  description?: string;
  genres?: string[];
  productType?: MgsProductType; // 配信タイプ
  aiDescription?: GeneratedDescription;
  aiTags?: {
    genres: string[];
    attributes: string[];
    plays: string[];
    situations: string[];
  };
}

/**
 * カテゴリURLから商品URLリストを取得
 */
async function fetchProductUrlsFromCategory(
  baseUrl: string,
  page: number,
): Promise<{ urls: string[]; totalPages: number; totalCount: number | null }> {
  // ページパラメータを追加
  const separator = baseUrl.includes('?') ? '&' : '?';
  const url = `${baseUrl}${separator}page=${page}`;

  console.log(`  📄 Fetching category page ${page}: ${url}`);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Cookie': 'adc=1',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response['status']}: ${response.statusText}`);
  }

  const html = await response['text']();
  const $ = cheerio.load(html);

  const productUrls: string[] = [];
  const seen = new Set<string>();

  $('a[href*="/product/product_detail/"]').each((_, elem) => {
    const href = $(elem).attr('href');
    if (href) {
      const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
      if (!seen.has(fullUrl)) {
        seen.add(fullUrl);
        productUrls.push(fullUrl);
      }
    }
  });

  // 総件数を取得（例: "112,166件"）
  let totalCount: number | null = null;
  const countMatch = html.match(/(\d{1,3}(?:,\d{3})+)\s*件/);
  if (countMatch && countMatch[1]) {
    totalCount = parseInt(countMatch[1].replace(/,/g, ''), 10);
  }

  // 総ページ数を取得
  let totalPages = 1;
  const paginationText = $('.pager_num').text().trim();
  const totalMatch = paginationText.match(/\/\s*(\d+)/);
  if (totalMatch && totalMatch[1]) {
    totalPages = parseInt(totalMatch[1], 10);
  } else {
    // ページネーションリンクから最大ページを推定
    let maxPage = 1;
    $('a[href*="page="]').each((_, elem) => {
      const href = $(elem).attr('href') || '';
      const pageMatch = href.match(/page=(\d+)/);
      if (pageMatch && pageMatch[1]) {
        const pageNum = parseInt(pageMatch[1], 10);
        if (pageNum > maxPage) maxPage = pageNum;
      }
    });
    totalPages = maxPage;
  }

  // 件数から総ページを推定（バックアップ）
  if (totalCount && totalPages < 10) {
    const estimatedPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
    if (estimatedPages > totalPages) {
      console.log(`    ℹ️ Estimated pages from count: ${estimatedPages}`);
      totalPages = estimatedPages;
    }
  }

  return { urls: productUrls, totalPages, totalCount };
}

/**
 * 月額チャンネルURLから商品URLリストを取得
 */
async function fetchProductUrlsFromChannel(
  shopId: string,
  page: number,
): Promise<{ urls: string[]; totalPages: number }> {
  const url = `${BASE_URL}/search/cSearch.php?sort=new&search_shop_id=${shopId}&type=monthly&list_cnt=${ITEMS_PER_PAGE}&page=${page}`;

  console.log(`  📄 Fetching channel page ${page}: ${url}`);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Cookie': 'adc=1',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response['status']}: ${response.statusText}`);
  }

  const html = await response['text']();
  const $ = cheerio.load(html);

  const productUrls: string[] = [];
  const seen = new Set<string>();

  $('a[href*="/product/product_detail/"]').each((_, elem) => {
    const href = $(elem).attr('href');
    if (href) {
      const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
      if (!seen.has(fullUrl)) {
        seen.add(fullUrl);
        productUrls.push(fullUrl);
      }
    }
  });

  // 総ページ数を取得
  let totalPages = 1;
  $('a[href*="page="]').each((_, elem) => {
    const href = $(elem).attr('href') || '';
    const pageMatch = href.match(/page=(\d+)/);
    if (pageMatch && pageMatch[1]) {
      const pageNum = parseInt(pageMatch[1], 10);
      if (pageNum > totalPages) totalPages = pageNum;
    }
  });

  return { urls: productUrls, totalPages };
}

/**
 * カテゴリベースのフルクロール
 */
async function runCategoryCrawl(
  enableAI: boolean,
  targetCategory?: string,
  maxPages: number = 1000,
  startPage: number = 1,
): Promise<void> {
  console.log('=== MGSカテゴリベースクロール ===');
  console.log(`AI: ${enableAI ? 'enabled' : 'disabled'}`);
  console.log(`Max pages: ${maxPages}, Start page: ${startPage}`);
  if (targetCategory) {
    console.log(`Target category: ${targetCategory}`);
  }

  const overallStats: CrawlStats = {
    totalFetched: 0,
    newProducts: 0,
    updatedProducts: 0,
    skippedUnchanged: 0,
    errors: 0,
  };

  const allProcessedUrls = new Set<string>();

  // カテゴリをクロール（動画配信、DVD）
  const categoriesToCrawl = targetCategory
    ? MGS_CATEGORIES.filter(c => c.type === targetCategory)
    : MGS_CATEGORIES;

  for (const category of categoriesToCrawl) {
    console.log(`\n========================================`);
    console.log(`📂 Processing category: ${category.name}`);
    console.log(`========================================`);

    try {
      // 最初のページを取得して総ページ数を確認
      const firstResult = await fetchProductUrlsFromCategory(category.url, startPage);
      console.log(`  📊 Total count: ${firstResult.totalCount?.toLocaleString() || 'unknown'}`);
      console.log(`  📄 Total pages: ${firstResult.totalPages} (crawling up to page ${Math.min(firstResult.totalPages, startPage + maxPages - 1)})`);

      const seenUrls = new Set<string>();
      for (const url of firstResult.urls) {
        if (!seenUrls.has(url)) seenUrls.add(url);
      }

      const actualMaxPage = Math.min(firstResult.totalPages, startPage + maxPages - 1);

      // 2ページ目以降を取得
      for (let page = startPage + 1; page <= actualMaxPage; page++) {
        try {
          await new Promise(resolve => setTimeout(resolve, 500));
          const result = await fetchProductUrlsFromCategory(category.url, page);

          if (result.urls.length === 0) {
            console.log(`  ℹ️ No more products at page ${page}`);
            break;
          }

          for (const url of result.urls) {
            if (!seenUrls.has(url)) seenUrls.add(url);
          }

          console.log(`    ✅ Page ${page}/${actualMaxPage}: ${result.urls.length} products (total: ${seenUrls.size})`);

        } catch (error) {
          console.error(`  ❌ Error at page ${page}:`, error);
          break;
        }
      }

      // 重複を除外
      const newUrls = Array.from(seenUrls).filter(url => !allProcessedUrls.has(url));
      console.log(`\n  📦 Unique URLs for ${category.name}: ${seenUrls.size}`);
      console.log(`  📦 New URLs (excluding previous): ${newUrls.length}`);
      console.log(`  🚀 Processing with ${CONCURRENCY} parallel workers...`);

      // 各商品をクロール（並列処理）
      const stats: CrawlStats = {
        totalFetched: 0,
        newProducts: 0,
        updatedProducts: 0,
        skippedUnchanged: 0,
        errors: 0,
      };

      // URLを処理済みとしてマーク
      for (const url of newUrls) {
        allProcessedUrls.add(url);
      }

      // 並列処理でクロール
      await processBatchParallel(
        newUrls,
        category.type as MgsProductType,
        enableAI,
        stats,
        0,
        newUrls.length,
      );

      // 統計を累積
      overallStats.totalFetched += stats.totalFetched;
      overallStats.newProducts += stats.newProducts;
      overallStats.updatedProducts += stats.updatedProducts;
      overallStats.skippedUnchanged += stats.skippedUnchanged;
      overallStats.errors += stats.errors;

      console.log(`\n  📊 Category ${category.name} stats:`);
      console.table(stats);

    } catch (error) {
      console.error(`\n  ❌ Error processing category ${category.name}:`, error);
    }
  }

  // 月額チャンネルも対象なら
  if (!targetCategory || targetCategory === 'monthly') {
    for (const channel of MGS_MONTHLY_CHANNELS) {
      console.log(`\n========================================`);
      console.log(`📺 Processing channel: ${channel.name}`);
      console.log(`========================================`);

      try {
        const firstResult = await fetchProductUrlsFromChannel(channel.shopId, 1);
        console.log(`  📄 Total pages: ${firstResult.totalPages}`);

        const seenUrls = new Set<string>();
        for (const url of firstResult.urls) {
          if (!seenUrls.has(url)) seenUrls.add(url);
        }

        const actualMaxPage = Math.min(firstResult.totalPages, maxPages);

        for (let page = 2; page <= actualMaxPage; page++) {
          try {
            await new Promise(resolve => setTimeout(resolve, 500));
            const result = await fetchProductUrlsFromChannel(channel.shopId, page);

            if (result.urls.length === 0) break;

            for (const url of result.urls) {
              if (!seenUrls.has(url)) seenUrls.add(url);
            }

            console.log(`    ✅ Page ${page}/${actualMaxPage}: ${result.urls.length} products (total: ${seenUrls.size})`);

          } catch (error) {
            console.error(`  ❌ Error at page ${page}:`, error);
            break;
          }
        }

        const newUrls = Array.from(seenUrls).filter(url => !allProcessedUrls.has(url));
        console.log(`\n  📦 New URLs for ${channel.name}: ${newUrls.length}`);
        console.log(`  🚀 Processing with ${CONCURRENCY} parallel workers...`);

        const stats: CrawlStats = {
          totalFetched: 0,
          newProducts: 0,
          updatedProducts: 0,
          skippedUnchanged: 0,
          errors: 0,
        };

        // URLを処理済みとしてマーク
        for (const url of newUrls) {
          allProcessedUrls.add(url);
        }

        // 並列処理でクロール
        await processBatchParallel(
          newUrls,
          'monthly',
          enableAI,
          stats,
          0,
          newUrls.length,
        );

        overallStats.totalFetched += stats.totalFetched;
        overallStats.newProducts += stats.newProducts;
        overallStats.updatedProducts += stats.updatedProducts;
        overallStats.skippedUnchanged += stats.skippedUnchanged;
        overallStats.errors += stats.errors;

        console.log(`\n  📊 Channel ${channel.name} stats:`);
        console.table(stats);

      } catch (error) {
        console.error(`\n  ❌ Error processing channel ${channel.name}:`, error);
      }
    }
  }

  console.log('\n========================================');
  console.log('=== Category Crawl Complete ===');
  console.log('========================================\n');
  console.log('Overall Statistics:');
  console.table(overallStats);
  console.log(`\nTotal unique products processed: ${allProcessedUrls.size}`);
}

/**
 * シリーズキーワードで検索し、商品URLリストを取得（フルスキャン用）
 */
async function fetchProductUrlsBySeries(
  seriesKeyword: string,
  page: number,
  sort: SortOrder = 'new',
): Promise<{ urls: string[]; totalPages: number }> {
  // MGSの検索URLパターン
  const sortParam = sort === 'old' ? 'old' : sort === 'popular' ? 'pop' : 'new';
  const url = `${BASE_URL}/search/cSearch.php?search_word=${encodeURIComponent(seriesKeyword)}&sort=${sortParam}&list_cnt=${ITEMS_PER_PAGE}&page=${page}`;

  console.log(`  📄 [${seriesKeyword}] Page ${page}: ${url}`);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Cookie': 'adc=1',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response['status']}: ${response.statusText}`);
  }

  const html = await response['text']();
  const $ = cheerio.load(html);

  const productUrls: string[] = [];
  const seen = new Set<string>();

  $('a[href*="/product/product_detail/"]').each((_, elem) => {
    const href = $(elem).attr('href');
    if (href) {
      const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
      if (!seen.has(fullUrl)) {
        seen.add(fullUrl);
        productUrls.push(fullUrl);
      }
    }
  });

  // 総ページ数を取得
  let totalPages = 1;
  const paginationText = $('.pager_num').text().trim();
  const totalMatch = paginationText.match(/\/\s*(\d+)/);
  if (totalMatch && totalMatch[1]) {
    totalPages = parseInt(totalMatch[1], 10);
  } else {
    // ページネーションの最大値から推定
    let maxPage = 1;
    $('.pager_num a, .pager a').each((_, elem) => {
      const text = $(elem).text().trim();
      const pageNum = parseInt(text, 10);
      if (!isNaN(pageNum) && pageNum > maxPage) {
        maxPage = pageNum;
      }
    });
    totalPages = maxPage;
  }

  return { urls: productUrls, totalPages };
}

/**
 * シリーズ全体をクロール（全ページ取得）
 * 新着順(new)と古い順(old)の両方で検索して、漏れなく取得する
 */
async function crawlSeriesFull(
  seriesKeyword: string,
  maxPages: number = 1000,
  delayMs: number = 500,
): Promise<string[]> {
  const allUrls: string[] = [];
  const seenUrls = new Set<string>();

  console.log(`\n🔍 Crawling series: ${seriesKeyword}`);

  // 新着順と古い順の両方で検索（重複は自動除外）
  const sortOrders: SortOrder[] = ['new', 'old'];

  for (const sortOrder of sortOrders) {
    console.log(`  📋 Sort order: ${sortOrder}`);

    // 最初のページを取得して総ページ数を確認
    const firstResult = await fetchProductUrlsBySeries(seriesKeyword, 1, sortOrder);
    const totalPages = Math.min(firstResult.totalPages, maxPages);

    console.log(`  📊 Total pages for ${seriesKeyword} (${sortOrder}): ${firstResult.totalPages} (crawling up to ${totalPages})`);

    let newInThisSort = 0;
    for (const url of firstResult.urls) {
      if (!seenUrls.has(url)) {
        seenUrls.add(url);
        allUrls.push(url);
        newInThisSort++;
      }
    }

    // 2ページ目以降を取得
    let consecutiveNoNew = 0;
    for (let page = 2; page <= totalPages; page++) {
      try {
        await new Promise(resolve => setTimeout(resolve, delayMs));

        const result = await fetchProductUrlsBySeries(seriesKeyword, page, sortOrder);

        if (result.urls.length === 0) {
          console.log(`  ℹ️ No more products at page ${page}`);
          break;
        }

        let newOnThisPage = 0;
        for (const url of result.urls) {
          if (!seenUrls.has(url)) {
            seenUrls.add(url);
            allUrls.push(url);
            newOnThisPage++;
            newInThisSort++;
          }
        }

        console.log(`    ✅ Page ${page}/${totalPages}: ${result.urls.length} products, ${newOnThisPage} new (total: ${allUrls.length})`);

        // 連続して新規が0の場合は早期終了（ページがループしている可能性）
        if (newOnThisPage === 0) {
          consecutiveNoNew++;
          if (consecutiveNoNew >= 3) {
            console.log(`    ℹ️ No new products for 3 consecutive pages, stopping ${sortOrder} scan`);
            break;
          }
        } else {
          consecutiveNoNew = 0;
        }

      } catch (error) {
        console.error(`  ❌ Error at page ${page}:`, error);
        break;
      }
    }

    console.log(`  📦 New products from ${sortOrder} sort: ${newInThisSort}`);
  }

  console.log(`  📦 Total unique products for ${seriesKeyword}: ${allUrls.length}\n`);
  return allUrls;
}

/**
 * 一覧ページから商品URLリストを取得
 */
async function fetchProductUrls(page: number): Promise<string[]> {
  const url = `${BASE_URL}/search/cSearch.php?search_word=&sort=new&list_cnt=${ITEMS_PER_PAGE}&page=${page}`;
  console.log(`  📄 Fetching page ${page}: ${url}`);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Cookie': 'adc=1',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response['status']}: ${response.statusText}`);
  }

  const html = await response['text']();
  const $ = cheerio.load(html);

  const productUrls: string[] = [];
  const seen = new Set<string>();

  $('a[href*="/product/product_detail/"]').each((_, elem) => {
    const href = $(elem).attr('href');
    if (href) {
      const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
      if (!seen.has(fullUrl)) {
        seen.add(fullUrl);
        productUrls.push(fullUrl);
      }
    }
  });

  console.log(`  ✅ Found ${productUrls.length} unique products on page ${page}`);
  return productUrls;
}

/**
 * HTMLをアフィリエイトウィジェット形式に変換
 */
function generateAffiliateWidget(productId: string): string {
  const className = crypto.randomBytes(4).toString('hex');
  return `<div class="${className}"></div><script id="mgs_Widget_affiliate" type="text/javascript" charset="utf-8" src="https://static.mgstage.com/mgs/script/common/mgs_Widget_affiliate.js?c=${AFFILIATE_CODE}&t=text&o=t&b=t&s=MOMO&p=${productId}&from=ppv&class=${className}"></script>`;
}

/**
 * MGS商品ページをパース
 */
function parseMgsProductPage(html: string, productUrl: string): MgsProduct | null {
  const $ = cheerio.load(html);

  // 商品IDを抽出
  const productIdMatch = productUrl.match(/product_detail\/([^\/]+)/);
  if (!productIdMatch || !productIdMatch[1]) return null;
  const productId = productIdMatch[1];

  // タイトル
  const title = $('h1.tag').text().trim() || $('title').text().trim();

  // トップページ検出
  if (isTopPageHtml(html, 'MGS') ||
      title.includes('エロ動画・アダルトビデオ -MGS動画') ||
      title.includes('MGS動画＜プレステージ グループ＞')) {
    return null;
  }

  // 商品詳細ページチェック
  const hasProductDetails = $('th:contains("配信開始日")').length > 0 ||
                            $('th:contains("出演")').length > 0;
  if (!hasProductDetails) return null;

  // リリース日
  const releaseDateText = $('th:contains("配信開始日")').next('td').text().trim();
  const releaseDate = releaseDateText ? releaseDateText.replace(/\//g, '-') : undefined;

  // 出演者
  const rawPerformerNames: string[] = [];
  $('th:contains("出演")').next('td').find('a').each((_, elem) => {
    const name = $(elem).text().trim();
    if (name) rawPerformerNames.push(name);
  });

  if (rawPerformerNames.length === 0) {
    const performerText = $('th:contains("出演")').next('td').text().trim();
    if (performerText) {
      performerText.split(/[、,\n]/).forEach((name) => {
        const trimmed = name.trim();
        if (trimmed) rawPerformerNames.push(trimmed);
      });
    }
  }

  const performerNames = rawPerformerNames
    .map(name => normalizePerformerName(name))
    .filter((name): name is string => name !== null && isValidPerformerForProduct(name, title));

  // サムネイル
  let thumbnailUrl: string | undefined;
  const ogImage = $('meta[property="og:image"]').attr('content');
  if (ogImage) {
    thumbnailUrl = ogImage.startsWith('http') ? ogImage : `${BASE_URL}${ogImage}`;
  }

  // サンプル画像
  const sampleImages: string[] = [];
  const shouldExcludeImage = (url: string): boolean => {
    return url.includes('sample_button') || url.includes('sample-button') ||
           url.includes('samplemovie') || url.includes('sample_movie') ||
           url.includes('btn_sample');
  };

  // パターン1: #sample-photo 内のaタグのhrefから拡大画像URLを取得
  $('#sample-photo a').each((_, elem) => {
    const href = $(elem).attr('href');
    if (href && !shouldExcludeImage(href)) {
      const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
      if (!sampleImages.includes(fullUrl)) {
        sampleImages.push(fullUrl);
      }
    }
  });

  // パターン2: a.sample_image からも取得
  $('a.sample_image').each((_, elem) => {
    const href = $(elem).attr('href');
    if (href && !shouldExcludeImage(href)) {
      const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
      if (!sampleImages.includes(fullUrl)) {
        sampleImages.push(fullUrl);
      }
    }
  });

  // パターン3: pics/やsampleを含むリンクのhrefから拡大画像URLを取得
  $('a[href*="pics/"], a[href*="/sample/"]').each((_, elem) => {
    const href = $(elem).attr('href');
    if (href && href.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
      if (!sampleImages.includes(fullUrl) && fullUrl !== thumbnailUrl && !shouldExcludeImage(fullUrl)) {
        sampleImages.push(fullUrl);
      }
    }
  });

  // パターン4: フォールバック - imgタグのsrcを使用（拡大版がない場合のみ）
  if (sampleImages.length === 0) {
    $('.sample-photo img, .sample-box img, .sample-image img, .product-sample img').each((_, elem) => {
      const imgSrc = $(elem).attr('src') || $(elem).attr('data-src');
      if (imgSrc && !shouldExcludeImage(imgSrc)) {
        const fullUrl = imgSrc.startsWith('http') ? imgSrc : `${BASE_URL}${imgSrc}`;
        if (!sampleImages.includes(fullUrl)) {
          sampleImages.push(fullUrl);
        }
      }
    });
  }

  // サンプル動画
  let sampleVideoUrl: string | undefined;

  // パターン1: video source タグから
  const videoSrc = $('video source').attr('src');
  if (videoSrc) {
    sampleVideoUrl = videoSrc.startsWith('http') ? videoSrc : `${BASE_URL}${videoSrc}`;
  }

  // パターン2: data-video-url 属性
  if (!sampleVideoUrl) {
    const dataVideoUrl = $('[data-video-url]').attr('data-video-url');
    if (dataVideoUrl) {
      sampleVideoUrl = dataVideoUrl.startsWith('http') ? dataVideoUrl : `${BASE_URL}${dataVideoUrl}`;
    }
  }

  // パターン3: sample_movie リンク
  if (!sampleVideoUrl) {
    const sampleMovieLink = $('a[href*="sample_movie"]').attr('href');
    if (sampleMovieLink) {
      sampleVideoUrl = sampleMovieLink.startsWith('http') ? sampleMovieLink : `${BASE_URL}${sampleMovieLink}`;
    }
  }

  // パターン4: JavaScriptから sample_url を抽出
  if (!sampleVideoUrl) {
    const scriptContent = $('script:contains("sample_url")').html();
    if (scriptContent) {
      const sampleUrlMatch = scriptContent.match(/sample_url['":\s]+['"]([^'"]+)['"]/);
      if (sampleUrlMatch?.[1]) {
        sampleVideoUrl = sampleUrlMatch[1].startsWith('http')
          ? sampleUrlMatch[1]
          : `${BASE_URL}${sampleUrlMatch[1]}`;
      }
    }
  }

  // 価格とセール情報
  // MGS uses div.price_list with radio buttons containing price info
  // Pattern: <input type="radio" name="price" value="download_hd,0,...,SIRO-5561,1480">
  // Also: <span id="download_hd_price">1,480円(税込)</span>
  let price: number | undefined;
  let saleInfo: SaleInfo | undefined;

  // Try to extract price from download_hd_price span (primary price)
  const downloadHdPriceText = $('#download_hd_price').text().trim();
  if (downloadHdPriceText) {
    const priceMatch = downloadHdPriceText.match(/(\d+(?:,\d+)*)/);
    if (priceMatch && priceMatch[1]) {
      price = parseInt(priceMatch[1].replace(/,/g, ''), 10);
    }
  }

  // Fallback: extract from radio button value
  if (!price) {
    const priceInput = $('input[name="price"][id="download_hd_btn"]');
    const priceValue = priceInput.attr('value');
    if (priceValue) {
      // Format: download_hd,0,uuid,PRODUCT-ID,1480
      const parts = priceValue.split(',');
      if (parts.length >= 5 && parts[4]) {
        const extractedPrice = parseInt(parts[4], 10);
        if (!isNaN(extractedPrice) && extractedPrice > 0) {
          price = extractedPrice;
        }
      }
    }
  }

  // Fallback 2: try streaming price if no download price
  if (!price) {
    const streamingPriceText = $('#streaming_price').text().trim();
    if (streamingPriceText) {
      const priceMatch = streamingPriceText.match(/(\d+(?:,\d+)*)/);
      if (priceMatch && priceMatch[1]) {
        price = parseInt(priceMatch[1].replace(/,/g, ''), 10);
      }
    }
  }

  // Check for sale prices (del/strike elements with original price)
  const priceListDiv = $('div.price_list');
  const delPrice = priceListDiv.find('del, .price_del, s, strike').text().trim();
  const delPriceMatch = delPrice.match(/(\d+(?:,\d+)*)/);

  if (delPriceMatch && delPriceMatch[1] && price) {
    const regularPrice = parseInt(delPriceMatch[1].replace(/,/g, ''), 10);
    if (price < regularPrice) {
      // This is a sale
      const discountPercent = Math.round((1 - price / regularPrice) * 100);
      saleInfo = {
        regularPrice,
        salePrice: price,
        discountPercent,
        saleType: 'timesale',
      };
    }
  }

  // Legacy fallback: old method using th:contains("価格")
  if (!price) {
    const priceTd = $('th:contains("価格")').next('td');
    const priceText = priceTd.text().trim();
    const priceMatch = priceText.match(/(\d+(?:,\d+)*)/g);
    if (priceMatch && priceMatch[0]) {
      price = parseInt(priceMatch[0].replace(/,/g, ''), 10);
    }
  }

  // 説明文
  const description = $('#introduction .introduction').text().trim() || undefined;

  // ジャンル
  const genres: string[] = [];
  $('th:contains("ジャンル")').next('td').find('a').each((_, elem) => {
    const genre = $(elem).text().trim();
    if (genre) genres.push(genre);
  });

  const result: MgsProduct = {
    productId,
    url: productUrl,
    title,
  };

  if (releaseDate !== undefined) result.releaseDate = releaseDate;
  if (performerNames.length > 0) result.performerNames = performerNames;
  if (thumbnailUrl !== undefined) result.thumbnailUrl = thumbnailUrl;
  if (sampleImages.length > 0) result.sampleImages = sampleImages;
  if (sampleVideoUrl !== undefined) result.sampleVideoUrl = sampleVideoUrl;
  if (price !== undefined) result.price = price;
  if (saleInfo !== undefined) result.saleInfo = saleInfo;
  if (description !== undefined) result.description = description;
  if (genres.length > 0) result.genres = genres;

  return result;
}

/**
 * 商品データをDBに保存
 */
async function saveProduct(
  mgsProduct: MgsProduct,
  html: string,
  enableAI: boolean,
  stats: CrawlStats,
): Promise<void> {
  const db = getDb();
  const normalizedProductId = mgsProduct.productId.toLowerCase();

  // 商品データの検証
  const validation = validateProductData({
    title: mgsProduct.title,
    aspName: 'MGS',
    originalId: mgsProduct.productId,
  });

  if (!validation.isValid) {
    console.log(`    ⚠️ Skip: ${validation.reason}`);
    return;
  }

  try {
    // HTMLハッシュ計算
    const hash = calculateHash(html);

    // 既存データチェック（raw_html_data）
    const existingRaw = await db
      .select()
      .from(rawHtmlData)
      .where(and(eq(rawHtmlData.source, SOURCE_NAME), eq(rawHtmlData.productId, mgsProduct.productId)))
      .limit(1);

    if (existingRaw.length > 0 && existingRaw[0]?.hash === hash) {
      console.log(`    ⏭️ No changes, skipping`);
      stats.skippedUnchanged++;
      return;
    }

    // 生HTML保存
    const { gcsUrl, htmlContent } = await saveRawHtml('mgs', mgsProduct.productId, html);

    if (existingRaw.length > 0) {
      await db
        .update(rawHtmlData)
        .set({ htmlContent, gcsUrl, hash, crawledAt: new Date(), processedAt: null })
        .where(eq(rawHtmlData.id, existingRaw[0]!.id));
    } else {
      await db['insert'](rawHtmlData).values({
        source: SOURCE_NAME,
        productId: mgsProduct.productId,
        url: mgsProduct.url,
        htmlContent,
        gcsUrl,
        hash,
      });
    }

    // productsテーブルにupsert
    const productRecord = await db
      .select()
      .from(products)
      .where(eq(products.normalizedProductId, normalizedProductId))
      .limit(1);

    let productId: number;

    if (productRecord.length === 0) {
      const [newProduct] = await db
        .insert(products)
        .values({
          normalizedProductId,
          title: mgsProduct.title,
          releaseDate: mgsProduct.releaseDate ? String(mgsProduct.releaseDate) : null,
          defaultThumbnailUrl: mgsProduct.thumbnailUrl,
        })
        .returning();

      productId = newProduct!.id;
      stats.newProducts++;
      console.log(`    ✓ New product (id: ${productId})`);
    } else {
      productId = productRecord[0]!.id;
      await db
        .update(products)
        .set({
          title: mgsProduct.title,
          releaseDate: mgsProduct.releaseDate ?? null,
          defaultThumbnailUrl: mgsProduct.thumbnailUrl,
          updatedAt: new Date(),
        })
        .where(eq(products['id'], productId));
      stats.updatedProducts++;
      console.log(`    ✓ Updated (id: ${productId})`);
    }

    // product_sourcesに保存
    const affiliateWidget = generateAffiliateWidget(mgsProduct.productId);
    const existingSource = await db
      .select()
      .from(productSources)
      .where(and(eq(productSources.productId, productId), eq(productSources.aspName, SOURCE_NAME)))
      .limit(1);

    if (existingSource.length > 0) {
      await db
        .update(productSources)
        .set({
          affiliateUrl: affiliateWidget,
          originalProductId: mgsProduct.productId,
          price: mgsProduct.price,
          productType: mgsProduct.productType,
          lastUpdated: new Date(),
        })
        .where(eq(productSources.id, existingSource[0]!.id));
    } else {
      await db['insert'](productSources).values({
        productId,
        aspName: SOURCE_NAME,
        originalProductId: mgsProduct.productId,
        affiliateUrl: affiliateWidget,
        price: mgsProduct.price,
        productType: mgsProduct.productType,
        dataSource: 'HTML',
      });
    }

    // 出演者保存
    if (mgsProduct.performerNames && mgsProduct.performerNames.length > 0) {
      for (const name of mgsProduct.performerNames) {
        const performerRecord = await db
          .select()
          .from(performers)
          .where(eq(performers['name'], name))
          .limit(1);

        let performerId: number;
        if (performerRecord.length === 0) {
          const [newPerformer] = await db['insert'](performers).values({ name }).returning();
          performerId = newPerformer!.id;
        } else {
          performerId = performerRecord[0]!.id;
        }

        const existingLink = await db
          .select()
          .from(productPerformers)
          .where(and(eq(productPerformers.productId, productId), eq(productPerformers.performerId, performerId)))
          .limit(1);

        if (existingLink.length === 0) {
          await db['insert'](productPerformers).values({ productId, performerId });
        }
      }
    }

    // 画像保存
    if (mgsProduct.thumbnailUrl) {
      const existing = await db
        .select()
        .from(productImages)
        .where(and(eq(productImages.productId, productId), eq(productImages.imageUrl, mgsProduct.thumbnailUrl)))
        .limit(1);

      if (existing.length === 0) {
        await db['insert'](productImages).values({
          productId,
          imageUrl: mgsProduct.thumbnailUrl,
          imageType: 'thumbnail',
          displayOrder: 0,
          aspName: SOURCE_NAME,
        });
      }
    }

    if (mgsProduct.sampleImages) {
      for (let i = 0; i < mgsProduct.sampleImages.length; i++) {
        const imageUrl = mgsProduct.sampleImages[i];
        if (!imageUrl) continue;
        const existing = await db
          .select()
          .from(productImages)
          .where(and(eq(productImages.productId, productId), eq(productImages.imageUrl, imageUrl)))
          .limit(1);

        if (existing.length === 0) {
          await db['insert'](productImages).values({
            productId,
            imageUrl,
            imageType: 'sample',
            displayOrder: i + 1,
            aspName: SOURCE_NAME,
          });
        }
      }
    }

    // 動画保存
    if (mgsProduct.sampleVideoUrl) {
      const existing = await db
        .select()
        .from(productVideos)
        .where(and(eq(productVideos.productId, productId), eq(productVideos.videoUrl, mgsProduct.sampleVideoUrl)))
        .limit(1);

      if (existing.length === 0) {
        await db['insert'](productVideos).values({
          productId,
          videoUrl: mgsProduct.sampleVideoUrl,
          videoType: 'sample',
          displayOrder: 0,
          aspName: SOURCE_NAME,
        }).onConflictDoNothing();
      }
    }

    // セール情報保存
    if (mgsProduct.saleInfo) {
      await saveSaleInfo(SOURCE_NAME, mgsProduct.productId, mgsProduct.saleInfo);
    }

    // AI処理（CrawlerAIHelper使用）
    if (enableAI) {
      try {
        console.log('    🤖 AI processing...');
        const aiHelper = getAIHelper();
        const aiResult = await aiHelper.processProduct(
          {
            title: mgsProduct.title,
            ...(mgsProduct.description !== undefined && { description: mgsProduct.description }),
            ...(mgsProduct.performerNames !== undefined && { performers: mgsProduct.performerNames }),
            ...(mgsProduct.genres !== undefined && { genres: mgsProduct.genres }),
          },
          {
            extractTags: true,
            translate: true,
            generateDescription: true,
          }
        );

        // エラーがあれば警告
        if (aiResult.errors.length > 0) {
          console.log(`    ⚠️ AI処理で一部エラー: ${aiResult.errors.join(', ')}`);
        }

        // AI説明文とタグを保存
        if (aiResult.description || (aiResult.tags && aiResult.tags.genres.length > 0)) {
          await db
            .update(products)
            .set({
              aiDescription: aiResult.description ? JSON.stringify(aiResult.description) : undefined,
              aiCatchphrase: aiResult.description?.catchphrase,
              aiShortDescription: aiResult.description?.shortDescription,
              aiTags: (aiResult.tags && (aiResult.tags.genres.length > 0 || aiResult.tags.attributes.length > 0)) ? JSON.stringify(aiResult.tags) : undefined,
            })
            .where(eq(products['id'], productId));
        }

        // 翻訳を保存
        if (aiResult.translations) {
          await db
            .update(products)
            .set({
              titleEn: aiResult.translations.en?.title,
              titleZh: aiResult.translations.zh?.title,
              titleKo: aiResult.translations.ko?.title,
              descriptionEn: aiResult.translations.en?.description,
              descriptionZh: aiResult.translations.zh?.description,
              descriptionKo: aiResult.translations.ko?.description,
            })
            .where(eq(products['id'], productId));
        }
      } catch (error) {
        console.error('    ⚠️ AI processing failed:', error);
      }
    }

    // MGSタグと紐付け
    const mgsTag = await db['select']().from(tags).where(eq(tags.name, SOURCE_NAME)).limit(1);
    let providerTagId: number;

    if (mgsTag.length === 0) {
      const [newTag] = await db['insert'](tags).values({ name: SOURCE_NAME, category: 'provider' }).returning();
      providerTagId = newTag!.id;
    } else {
      providerTagId = mgsTag[0]!.id;
    }

    const existingTagLink = await db
      .select()
      .from(productTags)
      .where(and(eq(productTags.productId, productId), eq(productTags.tagId, providerTagId)))
      .limit(1);

    if (existingTagLink.length === 0) {
      await db['insert'](productTags).values({ productId, tagId: providerTagId });
    }

    // ジャンルタグを保存
    if (mgsProduct.genres && mgsProduct.genres.length > 0) {
      for (const genreName of mgsProduct.genres) {
        // ジャンルタグを取得または作成
        const existingGenreTag = await db
          .select()
          .from(tags)
          .where(and(eq(tags.name, genreName), eq(tags.category, 'genre')))
          .limit(1);

        let genreTagId: number;
        if (existingGenreTag.length === 0) {
          const [newGenreTag] = await db
            .insert(tags)
            .values({ name: genreName, category: 'genre' })
            .returning();
          genreTagId = newGenreTag!.id;
        } else {
          genreTagId = existingGenreTag[0]!.id;
        }

        // 商品とジャンルタグの紐付け
        const existingGenreLink = await db
          .select()
          .from(productTags)
          .where(and(eq(productTags.productId, productId), eq(productTags.tagId, genreTagId)))
          .limit(1);

        if (existingGenreLink.length === 0) {
          await db['insert'](productTags).values({ productId, tagId: genreTagId });
        }
      }
    }

  } catch (error) {
    console.error(`    ❌ Error:`, error);
    stats.errors++;
  }
}

/**
 * フルスキャンモード: 全シリーズをクロール
 */
async function runFullScan(
  enableAI: boolean,
  targetSeries?: string,
  maxPagesPerSeries: number = 500,
): Promise<void> {
  console.log('=== MGSフルスキャンモード ===');
  console.log(`AI: ${enableAI ? 'enabled' : 'disabled'}`);
  console.log(`Max pages per series: ${maxPagesPerSeries}`);

  const seriesToCrawl = targetSeries
    ? [targetSeries]
    : MGS_SERIES_PREFIXES;

  console.log(`\n📋 Series to crawl: ${seriesToCrawl.length}`);
  if (targetSeries) {
    console.log(`   Target series: ${targetSeries}`);
  }

  const overallStats: CrawlStats = {
    totalFetched: 0,
    newProducts: 0,
    updatedProducts: 0,
    skippedUnchanged: 0,
    errors: 0,
  };

  const allProcessedUrls = new Set<string>();

  for (let seriesIdx = 0; seriesIdx < seriesToCrawl.length; seriesIdx++) {
    const series = seriesToCrawl[seriesIdx];
    if (!series) continue;
    console.log(`\n========================================`);
    console.log(`[${seriesIdx + 1}/${seriesToCrawl.length}] Processing series: ${series}`);
    console.log(`========================================`);

    try {
      // シリーズの全URLを取得
      const seriesUrls = await crawlSeriesFull(series, maxPagesPerSeries);

      // 重複を除外
      const newUrls = seriesUrls.filter(url => !allProcessedUrls.has(url));
      console.log(`  📊 New URLs (excluding duplicates): ${newUrls.length}`);
      console.log(`  🚀 Processing with ${CONCURRENCY} parallel workers...`);

      // 各商品をクロール（並列処理）
      const stats: CrawlStats = {
        totalFetched: 0,
        newProducts: 0,
        updatedProducts: 0,
        skippedUnchanged: 0,
        errors: 0,
      };

      // URLを処理済みとしてマーク
      for (const url of newUrls) {
        allProcessedUrls.add(url);
      }

      // 並列処理でクロール（フルスキャンはhaishinタイプとして扱う）
      await processBatchParallel(
        newUrls,
        'haishin',
        enableAI,
        stats,
        0,
        newUrls.length,
      );

      // シリーズ統計を累積
      overallStats.totalFetched += stats.totalFetched;
      overallStats.newProducts += stats.newProducts;
      overallStats.updatedProducts += stats.updatedProducts;
      overallStats.skippedUnchanged += stats.skippedUnchanged;
      overallStats.errors += stats.errors;

      console.log(`\n  📊 Series ${series} stats:`);
      console.table(stats);

      // シリーズ間の待機
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      console.error(`\n  ❌ Error processing series ${series}:`, error);
    }
  }

  console.log('\n========================================');
  console.log('=== Full Scan Complete ===');
  console.log('========================================\n');
  console.log('Overall Statistics:');
  console.table(overallStats);
  console.log(`\nTotal unique products processed: ${allProcessedUrls.size}`);
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const pagesArg = args.find(arg => arg.startsWith('--pages='));
  const startPageArg = args.find(arg => arg.startsWith('--start-page='));
  const seriesArg = args.find(arg => arg.startsWith('--series='));
  const maxPagesArg = args.find(arg => arg.startsWith('--max-pages='));
  const categoryArg = args.find(arg => arg.startsWith('--category='));
  const enableAI = !args.includes('--no-ai');
  const fullScan = args.includes('--full-scan');
  const categoryCrawl = args.includes('--category-crawl');

  // カテゴリクロールモード
  // 使い方: npx tsx crawl-mgs-list.ts --category-crawl [--category=haishin|dvd|monthly] [--max-pages=100] [--start-page=1] [--no-ai]
  if (categoryCrawl) {
    const targetCategory = categoryArg ? categoryArg.split('=')[1] : undefined;
    const maxPages = maxPagesArg ? parseInt(maxPagesArg.split('=')[1] ?? '1000', 10) : 1000;
    const startPage = startPageArg ? parseInt(startPageArg.split('=')[1] ?? '1', 10) : 1;

    await runCategoryCrawl(enableAI, targetCategory, maxPages, startPage);
    process.exit(0);
    return;
  }

  // フルスキャンモード（シリーズベース）
  if (fullScan) {
    const targetSeries = seriesArg ? seriesArg.split('=')[1] : undefined;
    const maxPagesPerSeries = maxPagesArg ? parseInt(maxPagesArg.split('=')[1] ?? '500', 10) : 500;

    await runFullScan(enableAI, targetSeries, maxPagesPerSeries);
    process.exit(0);
    return;
  }

  // 通常モード
  const limit = limitArg ? parseInt(limitArg.split('=')[1] ?? '1000', 10) : 1000;
  const maxPages = pagesArg ? parseInt(pagesArg.split('=')[1] ?? '0', 10) : Math.ceil(limit / ITEMS_PER_PAGE);
  const startPage = startPageArg ? parseInt(startPageArg.split('=')[1] ?? '1', 10) : 1;
  const endPage = startPage + maxPages - 1;

  console.log('=== MGS一覧クローラー ===');
  console.log(`AI: ${enableAI ? 'enabled' : 'disabled'}`);
  console.log(`Limit: ${limit} products, Pages: ${startPage}-${endPage} (${maxPages} pages)\n`);

  const stats: CrawlStats = {
    totalFetched: 0,
    newProducts: 0,
    updatedProducts: 0,
    skippedUnchanged: 0,
    errors: 0,
  };

  const allProductUrls: string[] = [];

  // 一覧ページから商品URLを収集
  console.log('📋 Collecting product URLs from list pages...\n');
  for (let page = startPage; page <= endPage; page++) {
    try {
      const urls = await fetchProductUrls(page);
      allProductUrls.push(...urls);

      if (allProductUrls.length >= limit) {
        break;
      }

      // 次のページがあるかチェック
      if (urls.length < ITEMS_PER_PAGE) {
        console.log(`  ℹ️ Reached last page (page ${page})`);
        break;
      }

      // レート制限
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`  ❌ Error fetching page ${page}:`, error);
      break;
    }
  }

  const productUrls = allProductUrls.slice(0, limit);
  console.log(`\n📦 Total products to process: ${productUrls.length}`);
  console.log(`🚀 Processing with ${CONCURRENCY} parallel workers...\n`);

  // 各商品をクロール（並列処理）
  await processBatchParallel(
    productUrls,
    'haishin',
    enableAI,
    stats,
    0,
    productUrls.length,
  );

  console.log('\n=== Crawl Complete ===\n');
  console.log('Statistics:');
  console.table(stats);

  // MGS総件数を表示
  const db = getDb();
  const totalMgsCount = await db.execute(sql`
    SELECT COUNT(*) as count FROM product_sources WHERE asp_name = 'MGS'
  `);
  const withPriceCount = await db.execute(sql`
    SELECT COUNT(*) as count FROM product_sources WHERE asp_name = 'MGS' AND price > 0
  `);
  console.log(`\nMGS総商品数: ${totalMgsCount.rows[0]?.['count']}`);
  console.log(`  - 価格あり: ${withPriceCount.rows[0]?.['count']}`);

  process.exit(0);
}

// Only run main if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { fetchProductUrls, parseMgsProductPage };
