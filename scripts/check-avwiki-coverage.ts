/**
 * av-wikiのraw_html_dataとwiki_crawl_dataの対応を確認
 */
import { db } from '../packages/crawlers/src/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  // raw_html_dataにある商品コード
  const rawProducts = await db.execute(sql`
    SELECT DISTINCT UPPER(product_id) as product_code
    FROM raw_html_data
    WHERE source = 'WIKI-AV-WIKI'
  `);
  console.log(`raw_html_data に保存されている商品コード: ${rawProducts.rows.length}件`);

  // wiki_crawl_dataにある商品コード（av-wiki）
  const wikiProducts = await db.execute(sql`
    SELECT COUNT(DISTINCT product_code) as cnt
    FROM wiki_crawl_data
    WHERE source = 'av-wiki'
  `);
  console.log(`wiki_crawl_data (av-wiki) のユニーク商品コード: ${(wikiProducts.rows[0] as any).cnt}件`);

  // マッチする商品コード数
  const matchCount = await db.execute(sql`
    SELECT COUNT(DISTINCT w.product_code) as cnt
    FROM wiki_crawl_data w
    WHERE w.source = 'av-wiki'
      AND EXISTS (
        SELECT 1 FROM raw_html_data r
        WHERE r.source = 'WIKI-AV-WIKI'
          AND UPPER(r.product_id) = w.product_code
      )
  `);
  console.log(`\nraw_html_dataとマッチする商品コード: ${(matchCount.rows[0] as any).cnt}件`);

  // マッチするwiki_crawl_dataレコード数
  const matchRecords = await db.execute(sql`
    SELECT COUNT(*) as cnt
    FROM wiki_crawl_data w
    WHERE w.source = 'av-wiki'
      AND EXISTS (
        SELECT 1 FROM raw_html_data r
        WHERE r.source = 'WIKI-AV-WIKI'
          AND UPPER(r.product_id) = w.product_code
      )
  `);
  console.log(`マッチするwiki_crawl_dataレコード: ${(matchRecords.rows[0] as any).cnt}件（バックフィル可能）`);

  // マッチしないレコード数
  const nomatchRecords = await db.execute(sql`
    SELECT COUNT(*) as cnt
    FROM wiki_crawl_data w
    WHERE w.source = 'av-wiki'
      AND NOT EXISTS (
        SELECT 1 FROM raw_html_data r
        WHERE r.source = 'WIKI-AV-WIKI'
          AND UPPER(r.product_id) = w.product_code
      )
  `);
  console.log(`マッチしないwiki_crawl_dataレコード: ${(nomatchRecords.rows[0] as any).cnt}件（再クロール必要）`);

  // 文字化けしているデータの割合
  const mojibakeCount = await db.execute(sql`
    SELECT COUNT(*) as cnt
    FROM wiki_crawl_data
    WHERE source = 'av-wiki'
      AND performer_name !~ '[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]'
  `);
  console.log(`\n文字化けしているレコード: ${(mojibakeCount.rows[0] as any).cnt}件`);

  // 正常なデータの例
  const normalSample = await db.execute(sql`
    SELECT performer_name, product_code
    FROM wiki_crawl_data
    WHERE source = 'av-wiki'
      AND performer_name ~ '[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]'
    LIMIT 5
  `);
  console.log('\n=== 正常なデータの例 ===');
  for (const r of normalSample.rows as any[]) {
    console.log(`  ${r.performer_name} | ${r.product_code}`);
  }

  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
