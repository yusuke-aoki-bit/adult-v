/**
 * av-wikiの文字化けデータを削除するスクリプト
 */
import { db } from '../packages/crawlers/src/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('=== av-wiki 文字化けデータ削除 ===\n');

  // 削除前の状態を確認
  const beforeCount = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM wiki_crawl_data WHERE source = 'av-wiki'
  `);
  console.log(`削除前のav-wikiレコード数: ${(beforeCount.rows[0] as any).cnt}`);

  // 文字化けデータ数を確認
  const mojibakeCount = await db.execute(sql`
    SELECT COUNT(*) as cnt
    FROM wiki_crawl_data
    WHERE source = 'av-wiki'
      AND performer_name !~ '[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]'
  `);
  console.log(`文字化けレコード数: ${(mojibakeCount.rows[0] as any).cnt}`);

  // 文字化けデータを削除
  console.log('\n文字化けデータを削除中...');
  const deleteResult = await db.execute(sql`
    DELETE FROM wiki_crawl_data
    WHERE source = 'av-wiki'
      AND performer_name !~ '[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]'
  `);
  console.log(`削除完了: ${deleteResult.rowCount}件`);

  // 削除後の状態を確認
  const afterCount = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM wiki_crawl_data WHERE source = 'av-wiki'
  `);
  console.log(`\n削除後のav-wikiレコード数: ${(afterCount.rows[0] as any).cnt}`);

  // 残りのデータサンプル
  const sample = await db.execute(sql`
    SELECT performer_name, product_code
    FROM wiki_crawl_data
    WHERE source = 'av-wiki'
    LIMIT 10
  `);
  console.log('\n=== 残りのデータサンプル ===');
  for (const r of sample.rows as any[]) {
    console.log(`  ${r.performer_name} | ${r.product_code}`);
  }

  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
