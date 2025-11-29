import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

/**
 * DUGA, Sokmil, MGS以外のデータを削除
 *
 * 削除対象: DTI など
 */
async function main() {
  const db = getDb();

  console.log('=== 不要データの削除 ===\n');

  // 削除前の確認
  console.log('【削除前の状態】');
  const beforeCounts = await db.execute(sql`
    SELECT asp_name, COUNT(*) as count
    FROM product_sources
    GROUP BY asp_name
    ORDER BY count DESC
  `);
  console.table(beforeCounts.rows);

  const totalBefore = await db.execute(sql`
    SELECT COUNT(*) as total FROM products
  `);
  console.log('総商品数:', totalBefore.rows[0].total);

  // 削除対象のデータを確認
  console.log('\n【削除対象データ】');
  const toDelete = await db.execute(sql`
    SELECT asp_name, COUNT(*) as count
    FROM product_sources
    WHERE asp_name NOT IN ('DUGA', 'ソクミル', 'Sokmil', 'MGS')
    GROUP BY asp_name
  `);
  console.table(toDelete.rows);

  // 削除対象の商品IDを取得
  const deleteProductIds = await db.execute(sql`
    SELECT DISTINCT product_id
    FROM product_sources
    WHERE asp_name NOT IN ('DUGA', 'ソクミル', 'Sokmil', 'MGS')
    AND product_id NOT IN (
      SELECT DISTINCT product_id
      FROM product_sources
      WHERE asp_name IN ('DUGA', 'ソクミル', 'Sokmil', 'MGS')
    )
  `);

  console.log(`\n削除対象の孤立商品数: ${deleteProductIds.rows.length}`);

  // 確認プロンプト（コメントアウト）
  // const readline = require('readline');
  // const rl = readline.createInterface({
  //   input: process.stdin,
  //   output: process.stdout
  // });

  // const answer = await new Promise<string>((resolve) => {
  //   rl.question('\n本当に削除しますか？ (yes/no): ', resolve);
  // });
  // rl.close();

  // if (answer !== 'yes') {
  //   console.log('キャンセルしました。');
  //   process.exit(0);
  // }

  console.log('\n【削除開始】');

  // 1. product_sourcesから削除
  console.log('1. product_sourcesから削除中...');
  const deletedSources = await db.execute(sql`
    DELETE FROM product_sources
    WHERE asp_name NOT IN ('DUGA', 'ソクミル', 'Sokmil', 'MGS')
  `);
  console.log(`削除完了: ${deletedSources.rowCount}件`);

  // 2. product_imagesから孤立データを削除
  console.log('2. product_imagesから孤立データを削除中...');
  const deletedImages = await db.execute(sql`
    DELETE FROM product_images
    WHERE asp_name NOT IN ('DUGA', 'ソクミル', 'Sokmil', 'MGS')
  `);
  console.log(`削除完了: ${deletedImages.rowCount}件`);

  // 3. どのproduct_sourcesにも紐づかない商品を削除
  console.log('3. 孤立した商品を削除中...');
  const deletedProducts = await db.execute(sql`
    DELETE FROM products
    WHERE id NOT IN (
      SELECT DISTINCT product_id FROM product_sources
    )
  `);
  console.log(`削除完了: ${deletedProducts.rowCount}件`);

  // 4. 孤立した出演者リレーションを削除
  console.log('4. 孤立した product_performers を削除中...');
  const deletedPerformers = await db.execute(sql`
    DELETE FROM product_performers
    WHERE product_id NOT IN (
      SELECT DISTINCT id FROM products
    )
  `);
  console.log(`削除完了: ${deletedPerformers.rowCount}件`);

  // 削除後の状態
  console.log('\n【削除後の状態】');
  const afterCounts = await db.execute(sql`
    SELECT asp_name, COUNT(*) as count
    FROM product_sources
    GROUP BY asp_name
    ORDER BY count DESC
  `);
  console.table(afterCounts.rows);

  const totalAfter = await db.execute(sql`
    SELECT COUNT(*) as total FROM products
  `);
  console.log('総商品数:', totalAfter.rows[0].total);

  console.log('\n✅ クリーンアップ完了');

  process.exit(0);
}

main().catch((error) => {
  console.error('エラー:', error);
  process.exit(1);
});
