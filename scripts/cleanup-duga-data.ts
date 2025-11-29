import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

/**
 * DUGAデータ全削除スクリプト
 *
 * 既存のDUGAデータを削除して、APIからの再クロールに備えます
 */
async function main() {
  const db = getDb();

  console.log('=== DUGAデータの全削除 ===\n');

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

  // DUGAデータの確認
  console.log('\n【DUGA データ詳細】');
  const dugaDetails = await db.execute(sql`
    SELECT
      (SELECT COUNT(*) FROM product_sources WHERE asp_name = 'DUGA') as sources,
      (SELECT COUNT(*) FROM product_images WHERE asp_name = 'DUGA') as images,
      (SELECT COUNT(*) FROM products WHERE normalized_product_id LIKE 'duga-%') as products
  `);
  console.table(dugaDetails.rows);

  console.log('\n【削除開始】');

  // 1. product_sourcesからDUGAレコードを削除
  console.log('1. product_sourcesからDUGAデータを削除中...');
  const deletedSources = await db.execute(sql`
    DELETE FROM product_sources
    WHERE asp_name = 'DUGA'
  `);
  console.log(`削除完了: ${deletedSources.rowCount}件`);

  // 2. product_imagesからDUGA画像を削除
  console.log('2. product_imagesからDUGA画像を削除中...');
  const deletedImages = await db.execute(sql`
    DELETE FROM product_images
    WHERE asp_name = 'DUGA'
  `);
  console.log(`削除完了: ${deletedImages.rowCount}件`);

  // 3. どのproduct_sourcesにも紐づかないDUGA商品を削除
  console.log('3. 孤立したDUGA商品を削除中...');
  const deletedProducts = await db.execute(sql`
    DELETE FROM products
    WHERE normalized_product_id LIKE 'duga-%'
    AND id NOT IN (
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

  // 5. 孤立したカテゴリリレーションを削除
  console.log('5. 孤立した product_categories を削除中...');
  const deletedCategories = await db.execute(sql`
    DELETE FROM product_categories
    WHERE product_id NOT IN (
      SELECT DISTINCT id FROM products
    )
  `);
  console.log(`削除完了: ${deletedCategories.rowCount}件`);

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

  // 削除されたデータの集計
  const beforeTotal = parseInt(totalBefore.rows[0].total as string);
  const afterTotal = parseInt(totalAfter.rows[0].total as string);
  const deletedTotal = beforeTotal - afterTotal;

  console.log('\n【削除サマリー】');
  console.log(`削除された商品数: ${deletedTotal}件`);
  console.log(`product_sources: ${deletedSources.rowCount}件`);
  console.log(`product_images: ${deletedImages.rowCount}件`);
  console.log(`孤立商品: ${deletedProducts.rowCount}件`);

  console.log('\n✅ DUGAデータの削除完了');
  console.log('次のステップ: DUGA APIクローラーを実行してデータを再取得してください');
  console.log('実行コマンド:');
  console.log('  DATABASE_URL="..." npx tsx scripts/crawlers/crawl-duga-api.ts --limit=100 --offset=0');

  process.exit(0);
}

main().catch((error) => {
  console.error('エラー:', error);
  process.exit(1);
});
