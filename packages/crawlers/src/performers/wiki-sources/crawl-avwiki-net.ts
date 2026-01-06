/**
 * av-wiki.net クローラー
 * MGS等の素人系AVの品番・演者紐付け情報を取得
 *
 * 特徴:
 * - 数字付き品番（200GANA-1040等）をサポート
 * - WordPress検索機能を利用してシリーズ単位でクロール
 * - ページネーション対応（全ページを巡回）
 *
 * 使用方法:
 *   npx tsx packages/crawlers/src/performers/wiki-sources/crawl-avwiki-net.ts [--series=200GANA] [--limit=1000] [--max-pages=10]
 */

import * as cheerio from 'cheerio';
import { sql } from 'drizzle-orm';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

import { db, closeDb } from '../../lib/db';

const BASE_URL = 'https://av-wiki.net';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const DELAY_MS = 1500;

interface ProductPerformerEntry {
  productCode: string;
  performerName: string;
  source: string;
  sourceUrl: string;
}

// 対象シリーズ一覧（MGS素人系）
const TARGET_SERIES = [
  // ナンパTV系
  '200GANA',
  '230OREC',
  '230ORE',
  '230ORETD',
  // シロウトTV系
  'SIRO',
  // ラグジュTV系
  '259LUXU',
  // ナンパ系
  '300NTK',
  '300MIUM',
  '300MAAN',
  // その他MGS
  '390JAC',
  '390JNT',
  '420HOI',
];

async function fetchPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
        Referer: BASE_URL,
      },
    });

    if (!response.ok) {
      if (response['status'] === 404) {
        return null;
      }
      throw new Error(`HTTP ${response['status']}`);
    }

    return await response['text']();
  } catch (error) {
    console.error(`  Fetch error for ${url}: ${error}`);
    return null;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 検索結果ページから記事URLを抽出
 */
function extractArticleUrls(html: string): string[] {
  const urls: string[] = [];
  const $ = cheerio.load(html);

  // 各記事へのリンクを抽出
  $('article a, .post a, .entry-title a, h2 a, h3 a').each((_, link) => {
    const href = $(link).attr('href');
    if (href && href.startsWith(BASE_URL) && !href.includes('?s=')) {
      // 品番パターンを含むURLのみ
      if (/\/\d{0,3}[a-z]{2,10}-\d{2,5}\/?$/i.test(href)) {
        if (!urls.includes(href)) {
          urls.push(href);
        }
      }
    }
  });

  return urls;
}

/**
 * 検索結果のページ数を取得
 */
function getTotalPages(html: string): number {
  const $ = cheerio.load(html);

  // ページネーションから最大ページ数を取得
  // WordPress標準: .page-numbers, .pagination
  let maxPage = 1;

  $('.page-numbers, .pagination a, .nav-links a').each((_, el) => {
    const text = $(el).text().trim();
    const pageNum = parseInt(text, 10);
    if (!isNaN(pageNum) && pageNum > maxPage) {
      maxPage = pageNum;
    }
  });

  // 「... 71」のようなパターンも検出
  const paginationText = $('.pagination, .nav-links, .page-numbers').text();
  const pageNumbers = paginationText.match(/\d+/g);
  if (pageNumbers) {
    for (const num of pageNumbers) {
      const pageNum = parseInt(num, 10);
      if (!isNaN(pageNum) && pageNum > maxPage && pageNum < 1000) {
        maxPage = pageNum;
      }
    }
  }

  return maxPage;
}

/**
 * シリーズを検索してクロール
 * 検索結果から記事URLを抽出し、各記事ページから演者情報を取得
 */
async function crawlSeriesSearch(
  seriesCode: string,
  maxPages: number
): Promise<ProductPerformerEntry[]> {
  const entries: ProductPerformerEntry[] = [];
  const allArticleUrls: string[] = [];

  // 最初のページを取得してページ数を確認
  const firstPageUrl = `${BASE_URL}/?s=${encodeURIComponent(seriesCode)}`;
  console.log(`  Fetching search: ${firstPageUrl}`);

  const firstPageHtml = await fetchPage(firstPageUrl);
  if (!firstPageHtml) {
    console.log(`  No results for ${seriesCode}`);
    return entries;
  }

  const totalPages = Math.min(getTotalPages(firstPageHtml), maxPages);
  console.log(`  Total pages: ${totalPages} (max: ${maxPages})`);

  // 最初のページから記事URLを抽出
  const firstPageUrls = extractArticleUrls(firstPageHtml);
  allArticleUrls.push(...firstPageUrls);
  console.log(`  Page 1: ${firstPageUrls.length} article URLs`);

  // 残りのページから記事URLを抽出
  for (let page = 2; page <= totalPages; page++) {
    await delay(DELAY_MS);

    const pageUrl = `${BASE_URL}/page/${page}/?s=${encodeURIComponent(seriesCode)}`;
    console.log(`  Fetching page ${page}/${totalPages}...`);

    const html = await fetchPage(pageUrl);
    if (!html) {
      console.log(`  Page ${page} failed, skipping`);
      continue;
    }

    const pageUrls = extractArticleUrls(html);
    allArticleUrls.push(...pageUrls);
    console.log(`  Page ${page}: ${pageUrls.length} article URLs`);
  }

  console.log(`  Total article URLs: ${allArticleUrls.length}`);

  // 各記事ページから演者情報を取得
  for (let i = 0; i < allArticleUrls.length; i++) {
    const articleUrl = allArticleUrls[i];
    if (!articleUrl) continue;
    // URLから品番を抽出
    const match = articleUrl.match(/\/(\d{0,3}[a-z]{2,10}-\d{2,5})\/?$/i);
    if (!match?.[1]) continue;

    const productCode = match[1].toUpperCase();

    await delay(DELAY_MS);
    if ((i + 1) % 10 === 0) {
      console.log(`  Processing ${i + 1}/${allArticleUrls.length}...`);
    }

    const productEntries = await crawlProductPage(productCode);
    entries.push(...productEntries);

    if (productEntries.length > 0) {
      console.log(
        `    ${productCode}: ${productEntries.map((e) => e.performerName).join(', ')}`
      );
    }
  }

  return entries;
}

/**
 * 個別記事ページから演者を抽出（より詳細な情報）
 */
async function crawlProductPage(productCode: string): Promise<ProductPerformerEntry[]> {
  const entries: ProductPerformerEntry[] = [];

  // URLスラッグは小文字
  const slug = productCode.toLowerCase();
  const url = `${BASE_URL}/${slug}/`;

  const html = await fetchPage(url);
  if (!html) return entries;

  const $ = cheerio.load(html);

  // テーブルから「AV女優名」を抽出
  $('table tr, .entry-content tr').each((_, row) => {
    const $row = $(row);
    const cells = $row.find('th, td');

    if (cells.length < 2) return;

    const header = $(cells[0]).text().trim();
    const value = $(cells[1]).text().trim();

    // 「AV女優名」または「女優名」ヘッダーを探す
    if (header.includes('AV女優') || header.includes('女優名') || header === '出演') {
      // リンクから名前を取得
      const links = $row.find('a[href*="/av-actress/"]');
      if (links.length > 0) {
        links.each((_, link) => {
          const name = $(link).text().trim();
          if (name.length >= 2 && /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(name)) {
            entries.push({
              productCode: productCode.toUpperCase(),
              performerName: name,
              source: 'av-wiki-net',
              sourceUrl: url,
            });
          }
        });
      } else if (value) {
        // リンクがない場合はテキストから取得
        const names = value.split(/[,、/／\n]/).filter((n) => n.trim().length >= 2);
        for (const name of names) {
          const cleanName = name.trim();
          if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(cleanName)) {
            entries.push({
              productCode: productCode.toUpperCase(),
              performerName: cleanName,
              source: 'av-wiki-net',
              sourceUrl: url,
            });
          }
        }
      }
    }
  });

  // 本文からも抽出（「出演してるAV女優の名前は、XXXさんです。」パターン）
  const bodyText = $('.entry-content, .post-content, article').text();
  const actressMatch = bodyText.match(
    /(?:出演|出てる)(?:してる)?(?:AV)?女優(?:の名前)?(?:は[、,]?)?([^さ。]+)さん/
  );
  if (actressMatch?.[1]) {
    const name = actressMatch[1].trim();
    if (
      name.length >= 2 &&
      name.length <= 20 &&
      /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(name)
    ) {
      if (!entries.some((e) => e.performerName === name)) {
        entries.push({
          productCode: productCode.toUpperCase(),
          performerName: name,
          source: 'av-wiki-net',
          sourceUrl: url,
        });
      }
    }
  }

  return entries;
}

/**
 * DBに保存（バッチ処理）
 */
async function saveEntries(entries: ProductPerformerEntry[]): Promise<number> {
  if (entries.length === 0) return 0;

  let saved = 0;
  const BATCH_SIZE = 50;

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);

    try {
      // バッチINSERT用のVALUES句を構築
      const values = batch
        .map(
          (e) =>
            `('${e.source}', '${e.productCode.replace(/'/g, "''")}', '${e.performerName.replace(/'/g, "''")}', '${e.sourceUrl}', NOW())`
        )
        .join(',\n');

      await db.execute(sql.raw(`
        INSERT INTO wiki_crawl_data (source, product_code, performer_name, source_url, crawled_at)
        VALUES ${values}
        ON CONFLICT (source, product_code, performer_name) DO UPDATE SET
          source_url = EXCLUDED.source_url,
          crawled_at = NOW()
      `));
      saved += batch.length;
    } catch (error) {
      // バッチ失敗時は個別に保存を試行
      console.error(`  Batch insert failed, trying individual inserts...`);
      for (const entry of batch) {
        try {
          await db.execute(sql`
            INSERT INTO wiki_crawl_data (source, product_code, performer_name, source_url, crawled_at)
            VALUES (${entry['source']}, ${entry['productCode']}, ${entry['performerName']}, ${entry['sourceUrl']}, NOW())
            ON CONFLICT (source, product_code, performer_name) DO UPDATE SET
              source_url = EXCLUDED.source_url,
              crawled_at = NOW()
          `);
          saved++;
        } catch (innerError) {
          console.error(`  Error saving ${entry['productCode']}: ${innerError}`);
        }
      }
    }
  }

  return saved;
}

/**
 * DBから未処理のMGS商品を取得して個別にクロール
 */
async function crawlMissingProducts(limit: number): Promise<ProductPerformerEntry[]> {
  const entries: ProductPerformerEntry[] = [];

  // MGSの仮名演者を持つ商品で、wiki_crawl_dataに存在しないものを取得
  const result = await db.execute(sql`
    SELECT DISTINCT p.normalized_product_id
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    JOIN product_performers pp ON p.id = pp.product_id
    JOIN performers pf ON pp.performer_id = pf.id
    WHERE ps.asp_name = 'MGS'
    AND pf.name LIKE '%歳%'
    AND pf.name NOT LIKE '%千歳%'
    AND pf.name NOT LIKE '%万歳%'
    AND NOT EXISTS (
      SELECT 1 FROM wiki_crawl_data w
      WHERE w.product_code = p.normalized_product_id
      OR w.product_code = REGEXP_REPLACE(p.normalized_product_id, '^\d+', '')
    )
    ORDER BY p.created_at DESC
    LIMIT ${limit}
  `);

  console.log(`  Found ${result.rows.length} missing products`);

  for (const row of result.rows as { normalized_product_id: string }[]) {
    const productCode = row.normalized_product_id;
    console.log(`  Crawling: ${productCode}`);

    const productEntries = await crawlProductPage(productCode);
    entries.push(...productEntries);

    if (productEntries.length > 0) {
      console.log(`    Found: ${productEntries.map((e) => e.performerName).join(', ')}`);
    }

    await delay(DELAY_MS);
  }

  return entries;
}

async function main() {
  console.log('=== av-wiki.net Crawler ===');
  console.log(`Base URL: ${BASE_URL}`);

  // コマンドライン引数を解析
  const args = process.argv.slice(2);
  let targetSeries = [...TARGET_SERIES];
  let limit = 1000;
  let maxPages = 20;
  let crawlMissing = false;

  for (const arg of args) {
    if (arg.startsWith('--series=')) {
      const seriesValue = arg.split('=')[1];
      if (seriesValue) {
        targetSeries = [seriesValue.toUpperCase()];
      }
    } else if (arg.startsWith('--limit=')) {
      const limitValue = arg.split('=')[1];
      if (limitValue) {
        limit = parseInt(limitValue, 10);
      }
    } else if (arg.startsWith('--max-pages=')) {
      const maxPagesValue = arg.split('=')[1];
      if (maxPagesValue) {
        maxPages = parseInt(maxPagesValue, 10);
      }
    } else if (arg === '--crawl-missing') {
      crawlMissing = true;
    }
  }

  console.log(`Target series: ${targetSeries.join(', ')}`);
  console.log(`Limit: ${limit}`);
  console.log(`Max pages per series: ${maxPages}`);
  console.log(`Crawl missing: ${crawlMissing}`);

  let totalEntries = 0;
  let totalSaved = 0;

  try {
    // シリーズ検索でクロール
    for (const series of targetSeries) {
      if (totalEntries >= limit) break;

      console.log(`\n=== Crawling series: ${series} ===`);

      const entries = await crawlSeriesSearch(series, maxPages);
      totalEntries += entries.length;

      if (entries.length > 0) {
        const saved = await saveEntries(entries);
        totalSaved += saved;
        console.log(`  Total for ${series}: ${entries.length} entries, ${saved} saved`);
      }

      await delay(DELAY_MS * 2);
    }

    // 個別商品のクロール（オプション）
    if (crawlMissing && totalEntries < limit) {
      console.log('\n=== Crawling missing products ===');
      const missingEntries = await crawlMissingProducts(limit - totalEntries);
      totalEntries += missingEntries.length;

      if (missingEntries.length > 0) {
        const saved = await saveEntries(missingEntries);
        totalSaved += saved;
        console.log(`  Missing products: ${missingEntries.length} entries, ${saved} saved`);
      }
    }

    console.log('\n=== Summary ===');
    console.log(`Total entries found: ${totalEntries}`);
    console.log(`Total saved: ${totalSaved}`);
  } catch (error) {
    console.error('Crawler error:', error);
    throw error;
  } finally {
    await closeDb();
  }
}

// 直接実行時
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

export { crawlSeriesSearch, crawlProductPage, saveEntries, crawlMissingProducts };
