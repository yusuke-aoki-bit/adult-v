/**
 * av-wiki.netの文字化けデータをバックフィルで修正するスクリプト
 *
 * raw_html_dataに保存されたHTMLを正しいUTF-8でデコードし直し、
 * wiki_crawl_dataを更新する
 */
import { db } from '../packages/crawlers/src/lib/db';
import { sql } from 'drizzle-orm';
import * as cheerio from 'cheerio';

interface RawHtmlRow {
  id: number;
  product_id: string;
  url: string;
  html_content: string;
}

interface WikiCrawlRow {
  id: number;
  performer_name: string;
}

async function extractPerformersFromHtml(html: string): Promise<string[]> {
  const $ = cheerio.load(html);
  const performers: string[] = [];

  // av-wiki.netのHTMLから女優名を抽出
  // パターン1: 出演者リンク
  $('a[href*="/actress/"], a[href*="/performer/"]').each((_, el) => {
    const name = $(el).text().trim();
    if (name && name.length > 0 && name.length < 50) {
      performers.push(name);
    }
  });

  // パターン2: 出演者テーブル
  $('th:contains("出演者"), th:contains("女優")').each((_, th) => {
    const td = $(th).next('td');
    const names = td.text().split(/[、,\s]+/).map(n => n.trim()).filter(n => n.length > 0 && n.length < 50);
    performers.push(...names);
  });

  // パターン3: WordPress構造 (av-wiki.netはWordPress)
  $('.cast-list a, .actress-name, .performer-name').each((_, el) => {
    const name = $(el).text().trim();
    if (name && name.length > 0 && name.length < 50) {
      performers.push(name);
    }
  });

  // 重複を除去
  return [...new Set(performers)];
}

async function main() {
  console.log('=== av-wiki.net 文字化けバックフィル ===\n');

  // raw_html_dataからav-wikiのHTMLを取得
  const rawData = await db.execute(sql`
    SELECT id, product_id, url, html_content
    FROM raw_html_data
    WHERE source = 'WIKI-AV-WIKI'
      AND html_content IS NOT NULL
    ORDER BY id
  `);

  console.log(`raw_html_data: ${rawData.rows.length}件のHTMLを処理\n`);

  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const row of rawData.rows as RawHtmlRow[]) {
    try {
      // HTMLから女優名を抽出（HTMLは既にUTF-8文字列として保存されているはず）
      const html = row.html_content;

      // 文字化けチェック（UTF-8として正しく読めるか）
      const hasValidJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(html);

      if (!hasValidJapanese) {
        console.log(`  [SKIP] ${row.product_id}: 日本語が検出されない`);
        skippedCount++;
        continue;
      }

      const performers = await extractPerformersFromHtml(html);

      if (performers.length === 0) {
        console.log(`  [SKIP] ${row.product_id}: 女優名を抽出できず`);
        skippedCount++;
        continue;
      }

      // 既存の文字化けデータを確認
      const existingData = await db.execute(sql`
        SELECT id, performer_name
        FROM wiki_crawl_data
        WHERE source = 'av-wiki'
          AND product_code = ${row.product_id.toUpperCase()}
      `);

      if (existingData.rows.length === 0) {
        console.log(`  [SKIP] ${row.product_id}: wiki_crawl_dataに該当なし`);
        skippedCount++;
        continue;
      }

      // 文字化けしているデータを更新
      const mojibakeRows = (existingData.rows as WikiCrawlRow[]).filter(r =>
        !/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(r.performer_name)
      );

      if (mojibakeRows.length === 0) {
        console.log(`  [OK] ${row.product_id}: 文字化けなし`);
        continue;
      }

      console.log(`  [FIX] ${row.product_id}: ${mojibakeRows.length}件の文字化けを修正`);
      console.log(`        抽出された女優名: ${performers.join(', ')}`);

      // 文字化けデータを削除して新しいデータを挿入
      await db.execute(sql`
        DELETE FROM wiki_crawl_data
        WHERE source = 'av-wiki'
          AND product_code = ${row.product_id.toUpperCase()}
      `);

      // 正しい女優名で再挿入
      for (const performer of performers) {
        await db.execute(sql`
          INSERT INTO wiki_crawl_data (source, product_code, performer_name, source_url, crawled_at, processed)
          VALUES ('av-wiki', ${row.product_id.toUpperCase()}, ${performer}, ${row.url}, NOW(), false)
        `);
      }

      updatedCount++;
    } catch (e) {
      console.error(`  [ERROR] ${row.product_id}: ${e}`);
      errorCount++;
    }
  }

  console.log('\n=== 結果サマリー ===');
  console.log(`  更新: ${updatedCount}件`);
  console.log(`  スキップ: ${skippedCount}件`);
  console.log(`  エラー: ${errorCount}件`);

  // 残りの文字化けデータ数を確認
  const remainingMojibake = await db.execute(sql`
    SELECT COUNT(*) as cnt
    FROM wiki_crawl_data
    WHERE source = 'av-wiki'
      AND performer_name !~ '[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]'
  `);
  console.log(`\n残りの文字化けデータ: ${(remainingMojibake.rows[0] as any).cnt}件`);
  console.log('（これらは再クロールが必要）');

  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
