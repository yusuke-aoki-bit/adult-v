/**
 * av-wikiの文字化けデータを削除するスクリプト v2
 * 正常な日本語文字を含まないデータを削除
 */
import { db } from '../packages/crawlers/src/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('=== av-wiki 文字化けデータ削除 v2 ===\n');

  // 削除前の状態を確認
  const beforeCount = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM wiki_crawl_data WHERE source = 'av-wiki'
  `);
  console.log(`削除前のav-wikiレコード数: ${(beforeCount.rows[0] as any).cnt}`);

  // サンプルデータを確認（文字コード分析）
  const sample = await db.execute(sql`
    SELECT performer_name,
           LENGTH(performer_name) as len,
           performer_name ~ '[ぁ-んァ-ン一-龯]' as has_japanese
    FROM wiki_crawl_data
    WHERE source = 'av-wiki'
    LIMIT 20
  `);
  console.log('\n=== サンプルデータ分析 ===');
  for (const r of sample.rows as any[]) {
    console.log(`  "${r.performer_name}" len=${r.len} jp=${r.has_japanese}`);
  }

  // 正常な日本語を含むデータ数
  const validCount = await db.execute(sql`
    SELECT COUNT(*) as cnt
    FROM wiki_crawl_data
    WHERE source = 'av-wiki'
      AND performer_name ~ '[ぁ-んァ-ン一-龯]'
  `);
  console.log(`\n正常な日本語を含むレコード数: ${(validCount.rows[0] as any).cnt}`);

  // 文字化けデータ（正常な日本語を含まない）を削除
  console.log('\n文字化けデータを削除中...');
  const deleteResult = await db.execute(sql`
    DELETE FROM wiki_crawl_data
    WHERE source = 'av-wiki'
      AND performer_name !~ '[ぁ-んァ-ン一-龯]'
  `);
  console.log(`削除完了: ${deleteResult.rowCount}件`);

  // 削除後の状態を確認
  const afterCount = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM wiki_crawl_data WHERE source = 'av-wiki'
  `);
  console.log(`\n削除後のav-wikiレコード数: ${(afterCount.rows[0] as any).cnt}`);

  // 残りのデータサンプル
  const afterSample = await db.execute(sql`
    SELECT performer_name, product_code
    FROM wiki_crawl_data
    WHERE source = 'av-wiki'
    LIMIT 10
  `);
  console.log('\n=== 残りのデータサンプル ===');
  for (const r of afterSample.rows as any[]) {
    console.log(`  ${r.performer_name} | ${r.product_code}`);
  }

  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
