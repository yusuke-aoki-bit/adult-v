import { db } from '../packages/crawlers/src/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  // wiki_crawl_dataテーブルの状況確認
  console.log('=== wiki_crawl_data テーブル ===');
  const wikiCount = await db.execute(sql`SELECT COUNT(*) as cnt FROM wiki_crawl_data`);
  console.log('総レコード数:', wikiCount.rows[0].cnt);

  // ユニーク商品コード数
  const uniqueCodes = await db.execute(sql`
    SELECT COUNT(DISTINCT product_code) as cnt FROM wiki_crawl_data
  `);
  console.log('ユニーク商品コード数:', uniqueCodes.rows[0].cnt);

  // ユニーク女優数
  const uniquePerformers = await db.execute(sql`
    SELECT COUNT(DISTINCT performer_name) as cnt FROM wiki_crawl_data
  `);
  console.log('ユニーク女優数:', uniquePerformers.rows[0].cnt);

  // ソース別件数
  const bySource = await db.execute(sql`
    SELECT source, COUNT(*) as cnt FROM wiki_crawl_data GROUP BY source ORDER BY cnt DESC
  `);
  console.log('\n=== ソース別件数 ===');
  for (const r of bySource.rows) {
    console.log(`  ${r.source}: ${r.cnt}`);
  }

  // サンプルデータを確認
  const sample = await db.execute(sql`
    SELECT product_code, performer_name, source, source_url
    FROM wiki_crawl_data
    ORDER BY crawled_at DESC
    LIMIT 10
  `);
  console.log('\n=== 最新サンプルデータ ===');
  for (const r of sample.rows) {
    console.log(`${r.product_code} → ${r.performer_name} (${r.source})`);
  }

  // MGS商品の総数
  console.log('\n=== MGS商品との紐づけ状況 ===');
  const mgsTotal = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM product_sources WHERE asp_name = 'MGS'
  `);
  console.log('MGS総商品数:', mgsTotal.rows[0].cnt);

  // 女優紐づけ済みMGS商品数
  const mgsWithPerformer = await db.execute(sql`
    SELECT COUNT(DISTINCT ps.product_id) as cnt
    FROM product_sources ps
    JOIN product_performers pp ON ps.product_id = pp.product_id
    WHERE ps.asp_name = 'MGS'
  `);
  console.log('女優紐づけ済みMGS商品数:', mgsWithPerformer.rows[0].cnt);

  // wikiデータとMGS商品のマッチ数
  const wikiMgsMatch = await db.execute(sql`
    SELECT COUNT(DISTINCT w.product_code) as cnt
    FROM wiki_crawl_data w
    JOIN product_sources ps ON UPPER(w.product_code) = UPPER(ps.original_product_id)
    WHERE ps.asp_name = 'MGS'
  `);
  console.log('wikiデータとMGS商品がマッチする商品コード数:', wikiMgsMatch.rows[0].cnt);

  // 商品コード形式の例
  console.log('\n=== 商品コード形式の比較 ===');
  const wikiCodes = await db.execute(sql`
    SELECT DISTINCT product_code FROM wiki_crawl_data
    WHERE source = 'seesaawiki'
    ORDER BY product_code
    LIMIT 10
  `);
  console.log('wiki商品コード例:');
  for (const r of wikiCodes.rows) {
    console.log('  ', r.product_code);
  }

  const mgsCodes = await db.execute(sql`
    SELECT DISTINCT original_product_id FROM product_sources
    WHERE asp_name = 'MGS'
    ORDER BY original_product_id
    LIMIT 10
  `);
  console.log('MGS商品コード例:');
  for (const r of mgsCodes.rows) {
    console.log('  ', r.original_product_id);
  }

  process.exit(0);
}
main().catch(e => {
  console.error(e);
  process.exit(1);
});
