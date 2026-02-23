/**
 * seesaawiki.jp/av_neme 並列クローラー
 *
 * 複数のページ範囲を並列で取得する
 * 使用方法:
 *   npx tsx scripts/crawlers/crawl-wiki-parallel.ts <start_page> <end_page>
 *
 * 例:
 *   npx tsx scripts/crawlers/crawl-wiki-parallel.ts 500 1000
 */

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres';
}

import * as cheerio from 'cheerio';
import { getDb } from './lib/db/index.js';
import { sql } from 'drizzle-orm';
import iconv from 'iconv-lite';
import { isValidPerformerName } from './lib/performer-validation.js';

const db = getDb();

// 除外ワード
const EXCLUDE_TERMS = new Set([
  '素人',
  '企画',
  '不明',
  '-',
  '---',
  'N/A',
  'etc',
  'etc.',
  '他',
  '出演者',
  '女優',
  '女優名',
  'AV女優',
  '男優',
  '配信開始日',
  '発売日',
  'タイトル',
  '品番',
  '収録時間',
  'ジャンル',
  'シリーズ',
  'メーカー',
  'レーベル',
  '編集する',
  '新規作成',
  '削除する',
  'コメント',
]);

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'ja-JP,ja;q=0.9',
      },
    });

    if (!response.ok) {
      console.log(`  ✗ HTTP ${response.status} for ${url}`);
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const html = iconv.decode(buffer, 'euc-jp');
    return html;
  } catch (error) {
    console.error(`  ✗ Error fetching ${url}:`, error);
    return null;
  }
}

async function saveToWikiCrawlData(
  source: string,
  productCode: string,
  performerNames: string[],
  sourceUrl: string,
): Promise<number> {
  let saved = 0;
  for (const name of performerNames) {
    if (EXCLUDE_TERMS.has(name)) continue;
    if (!isValidPerformerName(name)) continue;
    if (/^[A-Z]{2,10}-?\d{3,6}$/i.test(name)) continue;

    try {
      await db.execute(sql`
        INSERT INTO wiki_crawl_data (source, product_code, performer_name, source_url)
        VALUES (${source}, ${productCode}, ${name}, ${sourceUrl})
        ON CONFLICT (source, product_code, performer_name) DO NOTHING
      `);
      saved++;
    } catch {
      // ignore
    }
  }
  return saved;
}

function extractSeesaawikiPageData(
  $: cheerio.CheerioAPI,
  url: string,
): { products: Array<{ code: string; performers: string[] }> } {
  const products: Array<{ code: string; performers: string[] }> = [];

  // ページタイトルから女優名を抽出
  const pageTitle = $('h2')
    .first()
    .text()
    .trim()
    .replace(/\s*編集する?\s*/g, '')
    .replace(/\s*<.*$/g, '')
    .trim();

  const titleTag = $('title').text();
  const titleMatch = titleTag.match(/^([^-]+)/);
  const performerFromTitle = titleMatch ? titleMatch[1].trim() : '';

  let performerName = '';
  if (pageTitle && pageTitle.length >= 2 && pageTitle.length <= 20 && isValidPerformerName(pageTitle)) {
    performerName = pageTitle;
  } else if (
    performerFromTitle &&
    performerFromTitle.length >= 2 &&
    performerFromTitle.length <= 20 &&
    isValidPerformerName(performerFromTitle)
  ) {
    performerName = performerFromTitle;
  }

  if (!performerName) {
    return { products };
  }

  // 品番を見出し（h4, h5）から抽出
  const productCodes: string[] = [];

  $('h4, h5').each((_, elem) => {
    const text = $(elem).text().trim();
    // パターン: 英字+数字 or 英字+ハイフン+数字
    const codeMatch = text.match(/^([A-Za-z]{2,10}[-_]?\d{2,6})/);
    if (codeMatch) {
      const code = codeMatch[1].toUpperCase();
      if (!productCodes.includes(code)) {
        productCodes.push(code);
      }
    }

    // パターン: mgsod037| 形式
    const altMatch = text.match(/([A-Za-z]{2,10}\d{2,6})\|/);
    if (altMatch) {
      const code = altMatch[1].toUpperCase();
      if (!productCodes.includes(code)) {
        productCodes.push(code);
      }
    }
  });

  // 本文からも品番を抽出
  const bodyText = $('body').text();
  const bodyMatches = bodyText.match(/[A-Z]{2,10}-\d{2,6}/gi) || [];
  for (const match of bodyMatches) {
    const code = match.toUpperCase();
    if (!productCodes.includes(code) && code.length >= 6) {
      productCodes.push(code);
    }
  }

  // 各品番に出演者を関連付け
  for (const code of productCodes) {
    products.push({ code, performers: [performerName] });
  }

  return { products };
}

async function getAllPageUrls(startPage: number, endPage: number): Promise<string[]> {
  const allPageUrls: string[] = [];

  for (let page = startPage; page <= endPage; page++) {
    const listUrl = `https://seesaawiki.jp/av_neme/l/?p=${page}`;
    console.log(`  📄 Fetching page list ${page}...`);

    try {
      const html = await fetchHtml(listUrl);
      if (!html) break;

      const $ = cheerio.load(html);
      const pageLinks: string[] = [];

      $('a[href*="/av_neme/d/"]').each((_, elem) => {
        const href = $(elem).attr('href');
        if (href && !href.includes('?') && !href.includes('#')) {
          const fullUrl = href.startsWith('http') ? href : `https://seesaawiki.jp${href}`;
          if (!allPageUrls.includes(fullUrl) && !pageLinks.includes(fullUrl)) {
            pageLinks.push(fullUrl);
          }
        }
      });

      if (pageLinks.length === 0) {
        console.log(`    ✗ No entries found on page ${page}`);
        break;
      }

      allPageUrls.push(...pageLinks);
      console.log(`    ✅ Found ${pageLinks.length} entries (total: ${allPageUrls.length})`);

      // 次のページがあるか確認
      const hasNext = $('a:contains("次の100件")').length > 0;
      if (!hasNext) {
        console.log(`    📊 Reached last page`);
        break;
      }

      await new Promise((r) => setTimeout(r, 300));
    } catch (error) {
      console.error(`  Error fetching page ${page}:`, error);
      break;
    }
  }

  return allPageUrls;
}

async function crawlPages(
  pageUrls: string[],
  workerId: string,
): Promise<{ totalProducts: number; totalPerformers: number }> {
  let processed = 0;
  let totalPerformers = 0;
  let totalProducts = 0;

  for (const url of pageUrls) {
    console.log(`[${workerId}] [${processed + 1}/${pageUrls.length}] ${url}`);

    try {
      const html = await fetchHtml(url);
      if (!html) {
        processed++;
        continue;
      }

      const $ = cheerio.load(html);
      const pageData = extractSeesaawikiPageData($, url);

      if (pageData.products.length > 0) {
        for (const product of pageData.products) {
          if (product.performers.length > 0) {
            await saveToWikiCrawlData('seesaawiki', product.code, product.performers, url);
            console.log(`  ✅ ${product.code}: ${product.performers.join(', ')}`);
            totalPerformers += product.performers.length;
            totalProducts++;
          }
        }
      }
    } catch (error) {
      console.log(`  ✗ Error: ${error}`);
    }

    processed++;

    if (processed % 50 === 0) {
      console.log(`\n[${workerId}] 📊 Progress: ${processed}/${pageUrls.length} pages, ${totalProducts} products\n`);
    }

    await new Promise((r) => setTimeout(r, 400));
  }

  return { totalProducts, totalPerformers };
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log('使用方法: npx tsx scripts/crawlers/crawl-wiki-parallel.ts <start_page> <end_page>');
    console.log('例: npx tsx scripts/crawlers/crawl-wiki-parallel.ts 6 15');
    console.log('');
    console.log('ページ番号はseesaawikiの一覧ページ番号です（1ページ = 100エントリ）');
    process.exit(1);
  }

  const startPage = parseInt(args[0], 10);
  const endPage = parseInt(args[1], 10);
  const workerId = `W${startPage}-${endPage}`;

  console.log(`\n🚀 [${workerId}] Starting parallel wiki crawler`);
  console.log(`   Page range: ${startPage} - ${endPage}`);
  console.log(`   Estimated entries: ${(endPage - startPage + 1) * 100}\n`);

  // ページURLを収集
  console.log('📋 Collecting page URLs...');
  const pageUrls = await getAllPageUrls(startPage, endPage);
  console.log(`\n📊 Found ${pageUrls.length} unique pages to crawl\n`);

  if (pageUrls.length === 0) {
    console.log('No pages found. Exiting.');
    process.exit(0);
  }

  // クローリング開始
  const { totalProducts, totalPerformers } = await crawlPages(pageUrls, workerId);

  console.log(`\n✅ [${workerId}] Crawl complete!`);
  console.log(`   Pages processed: ${pageUrls.length}`);
  console.log(`   Products found: ${totalProducts}`);
  console.log(`   Performer links: ${totalPerformers}`);

  process.exit(0);
}

main().catch(console.error);
