/**
 * raw_html_dataからwiki_crawl_dataへのバックフィル
 *
 * 既にprocessed_atが設定されているがwiki_crawl_dataが空の場合に
 * 保存済みHTMLを再解析してwiki_crawl_dataにデータを追加する
 *
 * 使用方法:
 *   npx tsx scripts/backfill/backfill-wiki-from-raw.ts
 *   npx tsx scripts/backfill/backfill-wiki-from-raw.ts --limit=1000
 *   npx tsx scripts/backfill/backfill-wiki-from-raw.ts --dry-run
 */

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres';
}

import * as cheerio from 'cheerio';
import { db } from '../../lib/db/index.js';
import { sql } from 'drizzle-orm';
import { getRawContent } from '../../lib/gcs-crawler-helper.js';
import { isValidPerformerName } from '../../lib/performer-validation.js';

interface RawHtmlRow {
  id: number;
  source: string;
  product_id: string;
  url: string;
  html_content: string | null;
  gcs_url: string | null;
  processed_at: Date | null;
}

interface ExtractedData {
  productCode: string;
  performers: string[];
}

// 除外ワード
const EXCLUDE_TERMS = new Set([
  '素人', '企画', '不明', '-', '---', 'N/A', 'etc', 'etc.', '他',
  '出演者', '女優', '女優名', 'AV女優', '男優', '配信開始日', '発売日',
  'タイトル', '品番', '収録時間', 'ジャンル', 'シリーズ', 'メーカー', 'レーベル',
  '編集する', '新規作成', '削除する', 'コメント',
]);

/**
 * av-wiki形式のHTMLをパース
 */
function parseAvWiki(html: string, url: string): ExtractedData[] {
  const results: ExtractedData[] = [];
  const $ = cheerio.load(html);

  // entry-body内のテーブルから抽出
  const content = $('.entry-body').html() || $('body').html() || '';

  // 品番パターン: ABC-123形式
  const productMatches = content.match(/([A-Z]{2,10}[-_]?\d{3,6})/gi) || [];
  const uniqueProducts = [...new Set(productMatches.map(p => p.toUpperCase()))];

  // 出演者を抽出（リンクテキストや特定の構造から）
  const performers: string[] = [];

  // ページタイトルから出演者名を取得
  const pageTitle = $('h1.entry-title, h2.entry-title, .entry-title').first().text().trim();
  if (pageTitle && isValidPerformerName(pageTitle) && !EXCLUDE_TERMS.has(pageTitle)) {
    performers.push(pageTitle);
  }

  // テーブル内から出演者を抽出
  $('tr').each((_, row) => {
    const rowText = $(row).text();
    if (rowText.includes('出演') || rowText.includes('女優')) {
      $(row).find('td a, td').each((_, cell) => {
        const name = $(cell).text().trim();
        if (name &&
            name.length >= 2 &&
            name.length <= 30 &&
            isValidPerformerName(name) &&
            !EXCLUDE_TERMS.has(name) &&
            !name.match(/^[A-Z]{2,10}[-_]?\d{3,6}$/i)) {
          performers.push(name);
        }
      });
    }
  });

  // 品番と出演者を関連付け
  const uniquePerformers = [...new Set(performers)];
  for (const productCode of uniqueProducts) {
    if (uniquePerformers.length > 0) {
      results.push({ productCode, performers: uniquePerformers });
    }
  }

  return results;
}

/**
 * seesaawiki形式のHTMLをパース（crawl-wiki-parallel.tsと同様のロジック）
 */
function parseSeesaawiki(html: string, url: string): ExtractedData[] {
  const results: ExtractedData[] = [];
  const $ = cheerio.load(html);

  // ページタイトルから女優名を抽出
  const pageTitle = $('h2').first().text().trim()
    .replace(/\s*編集する?\s*/g, '')
    .replace(/\s*<.*$/g, '')
    .trim();

  const titleTag = $('title').text();
  const titleMatch = titleTag.match(/^([^-]+)/);
  const performerFromTitle = titleMatch ? titleMatch[1].trim() : '';

  let performerName = '';
  if (pageTitle && pageTitle.length >= 2 && pageTitle.length <= 20 && isValidPerformerName(pageTitle)) {
    performerName = pageTitle;
  } else if (performerFromTitle && performerFromTitle.length >= 2 && performerFromTitle.length <= 20 && isValidPerformerName(performerFromTitle)) {
    performerName = performerFromTitle;
  }

  if (!performerName || EXCLUDE_TERMS.has(performerName)) {
    return results;
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
    results.push({ productCode: code, performers: [performerName] });
  }

  return results;
}

/**
 * wiki_crawl_dataにデータを保存
 */
async function saveToWikiCrawlData(
  source: string,
  productCode: string,
  performerNames: string[],
  sourceUrl: string,
  dryRun: boolean
): Promise<number> {
  let saved = 0;
  for (const name of performerNames) {
    if (EXCLUDE_TERMS.has(name)) continue;
    if (!isValidPerformerName(name)) continue;
    if (/^[A-Z]{2,10}[-_]?\d{3,6}$/i.test(name)) continue;

    if (dryRun) {
      saved++;
      continue;
    }

    try {
      await db.execute(sql`
        INSERT INTO wiki_crawl_data (source, product_code, performer_name, source_url)
        VALUES (${source}, ${productCode}, ${name}, ${sourceUrl})
        ON CONFLICT (source, product_code, performer_name) DO NOTHING
      `);
      saved++;
    } catch {
      // ignore duplicates
    }
  }
  return saved;
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 500;
  const dryRun = args.includes('--dry-run');

  console.log('=== Wiki Raw HTML → wiki_crawl_data バックフィル ===');
  console.log(`Limit: ${limit}`);
  console.log(`Dry run: ${dryRun}`);
  console.log('');

  // wiki関連のraw_html_dataを取得（wiki-で始まる or seesaawiki, av-wikiを含む）
  const rawDataResult = await db.execute(sql`
    SELECT id, source, product_id, url, html_content, gcs_url, processed_at
    FROM raw_html_data
    WHERE source LIKE 'wiki-%'
       OR source LIKE '%seesaawiki%'
       OR source LIKE '%av-wiki%'
    ORDER BY id
    LIMIT ${limit}
  `);
  const rawDataRows = rawDataResult.rows as RawHtmlRow[];
  console.log(`Found ${rawDataRows.length} wiki raw_html_data entries\n`);

  let processed = 0;
  let totalProducts = 0;
  let totalPerformers = 0;
  let errors = 0;

  for (const row of rawDataRows) {
    processed++;
    console.log(`[${processed}/${rawDataRows.length}] ${row.source}: ${row.product_id}`);

    try {
      // HTMLコンテンツを取得（GCSまたはDB）
      const html = await getRawContent(row.gcs_url, row.html_content);
      if (!html) {
        console.log(`  ⚠️ No HTML content available`);
        errors++;
        continue;
      }

      // ソースに応じてパース
      let extracted: ExtractedData[] = [];
      if (row.source.includes('av-wiki')) {
        extracted = parseAvWiki(html, row.url);
      } else if (row.source.includes('seesaawiki') || row.source.includes('seesaa')) {
        extracted = parseSeesaawiki(html, row.url);
      } else {
        // 汎用的にseesaawiki形式で試す
        extracted = parseSeesaawiki(html, row.url);
      }

      if (extracted.length === 0) {
        console.log(`  ⏭️ No data extracted`);
        continue;
      }

      // wiki_crawl_dataに保存
      for (const data of extracted) {
        const saved = await saveToWikiCrawlData(
          row.source.replace('wiki-', ''),
          data.productCode,
          data.performers,
          row.url,
          dryRun
        );
        if (saved > 0) {
          console.log(`  ✅ ${data.productCode}: ${data.performers.join(', ')}`);
          totalProducts++;
          totalPerformers += saved;
        }
      }
    } catch (error) {
      console.log(`  ✗ Error: ${error}`);
      errors++;
    }

    // 進捗表示
    if (processed % 50 === 0) {
      console.log(`\n📊 Progress: ${processed}/${rawDataRows.length}, products: ${totalProducts}, performers: ${totalPerformers}\n`);
    }
  }

  console.log('\n=== 完了 ===');
  console.log(`Processed: ${processed}`);
  console.log(`Products extracted: ${totalProducts}`);
  console.log(`Performer links: ${totalPerformers}`);
  console.log(`Errors: ${errors}`);

  if (dryRun) {
    console.log('\n(Dry run - no changes made)');
  }

  // 結果確認
  const wikiStats = await db.execute(sql`
    SELECT source, COUNT(*) as count
    FROM wiki_crawl_data
    GROUP BY source
    ORDER BY count DESC
  `);
  console.log('\n=== wiki_crawl_data by source ===');
  for (const row of wikiStats.rows as any[]) {
    console.log(`  ${row.source}: ${row.count}`);
  }

  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
