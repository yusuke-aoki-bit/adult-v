/**
 * av-wikiの全データを削除するスクリプト
 * 文字化けデータが正規表現で検出できないため、全削除して再クロール
 */
import { db } from '../packages/crawlers/src/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('=== av-wiki 全データ削除 ===\n');

  // 削除前の状態を確認
  const beforeCount = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM wiki_crawl_data WHERE source = 'av-wiki'
  `);
  console.log(`削除前のav-wikiレコード数: ${(beforeCount.rows[0] as any).cnt}`);

  // 全av-wikiデータを削除
  console.log('\nav-wikiデータを全削除中...');
  const deleteResult = await db.execute(sql`
    DELETE FROM wiki_crawl_data WHERE source = 'av-wiki'
  `);
  console.log(`削除完了: ${deleteResult.rowCount}件`);

  // 削除後の確認
  const afterCount = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM wiki_crawl_data WHERE source = 'av-wiki'
  `);
  console.log(`\n削除後のav-wikiレコード数: ${(afterCount.rows[0] as any).cnt}`);

  // 他のソースの状態確認
  const otherSources = await db.execute(sql`
    SELECT source, COUNT(*) as cnt
    FROM wiki_crawl_data
    GROUP BY source
    ORDER BY cnt DESC
  `);
  console.log('\n=== 残りのソース別件数 ===');
  for (const r of otherSources.rows as any[]) {
    console.log(`  ${r.source}: ${r.cnt}`);
  }

  console.log('\n✅ av-wikiデータを削除しました');
  console.log('   avwiki-crawlerを実行すれば正しいエンコーディングで再取得されます');

  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
