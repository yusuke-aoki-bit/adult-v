/**
 * av-wikiの商品コード形式の違いを確認
 */
import { db } from '../packages/crawlers/src/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  // raw_html_dataの商品コード例
  const rawCodes = await db.execute(sql`
    SELECT DISTINCT product_id
    FROM raw_html_data
    WHERE source = 'WIKI-AV-WIKI'
    ORDER BY product_id
    LIMIT 20
  `);
  console.log('=== raw_html_data 商品コード例 ===');
  for (const r of rawCodes.rows as any[]) {
    console.log(`  ${r.product_id}`);
  }

  // wiki_crawl_dataの商品コード例
  const wikiCodes = await db.execute(sql`
    SELECT DISTINCT product_code
    FROM wiki_crawl_data
    WHERE source = 'av-wiki'
    ORDER BY product_code
    LIMIT 20
  `);
  console.log('\n=== wiki_crawl_data 商品コード例 ===');
  for (const r of wikiCodes.rows as any[]) {
    console.log(`  ${r.product_code}`);
  }

  // URLの形式を確認
  const rawUrls = await db.execute(sql`
    SELECT url
    FROM raw_html_data
    WHERE source = 'WIKI-AV-WIKI'
    LIMIT 5
  `);
  console.log('\n=== raw_html_data URL例 ===');
  for (const r of rawUrls.rows as any[]) {
    console.log(`  ${r.url}`);
  }

  const wikiUrls = await db.execute(sql`
    SELECT DISTINCT source_url
    FROM wiki_crawl_data
    WHERE source = 'av-wiki'
    LIMIT 5
  `);
  console.log('\n=== wiki_crawl_data URL例 ===');
  for (const r of wikiUrls.rows as any[]) {
    console.log(`  ${r.source_url}`);
  }

  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
