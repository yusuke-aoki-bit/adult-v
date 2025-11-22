/**
 * Complete DTI data cleanup script
 * This script will DELETE ALL DTI-related data including products table
 */

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres';
}

import { getDb } from '../lib/db/index';
import { sql } from 'drizzle-orm';

async function completeDtiCleanup() {
  const db = getDb();

  console.log('=== Complete DTI Data Cleanup ===\n');

  // 1. まずすべてのDTI関連データの件数を確認
  console.log('Checking current DTI data...\n');

  const rawHtmlCount = await db.execute(sql`
    SELECT COUNT(*) as count FROM raw_html_data
    WHERE source IN ('カリビアンコムプレミアム', '一本道', 'カリビアンコム', 'HEYZO', 'DTI')
  `);
  console.log(`raw_html_data: ${rawHtmlCount.rows[0].count} records`);

  const productSourcesCount = await db.execute(sql`
    SELECT COUNT(*) as count FROM product_sources
    WHERE asp_name IN ('カリビアンコムプレミアム', '一本道', 'カリビアンコム', 'HEYZO', 'DTI')
  `);
  console.log(`product_sources: ${productSourcesCount.rows[0].count} records`);

  const productCacheCount = await db.execute(sql`
    SELECT COUNT(*) as count FROM product_cache
    WHERE asp_name IN ('カリビアンコムプレミアム', '一本道', 'カリビアンコム', 'HEYZO', 'DTI')
  `);
  console.log(`product_cache: ${productCacheCount.rows[0].count} records`);

  // DTI product IDs を取得
  const dtiProductIds = await db.execute(sql`
    SELECT DISTINCT product_id FROM product_sources
    WHERE asp_name IN ('カリビアンコムプレミアム', '一本道', 'カリビアンコム', 'HEYZO', 'DTI')
  `);
  console.log(`DTI products: ${dtiProductIds.rows.length} records`);

  // 2. すべてのDTI関連テーブルを削除
  console.log('\n=== Starting Cleanup ===\n');

  // 2.1 raw_html_data
  console.log('Deleting raw_html_data...');
  await db.execute(sql`
    DELETE FROM raw_html_data
    WHERE source IN ('カリビアンコムプレミアム', '一本道', 'カリビアンコム', 'HEYZO', 'DTI')
  `);
  console.log('✓ Deleted raw_html_data');

  // 2.2 product_cache
  console.log('Deleting product_cache...');
  await db.execute(sql`
    DELETE FROM product_cache
    WHERE asp_name IN ('カリビアンコムプレミアム', '一本道', 'カリビアンコム', 'HEYZO', 'DTI')
  `);
  console.log('✓ Deleted product_cache');

  // 2.3 DTI製品のIDリストを一時変数に保存
  const dtiProductIdsList = dtiProductIds.rows.map(row => row.product_id);
  console.log(`DTI product IDs to clean: ${dtiProductIdsList.length} products`);

  // 2.4 product_performersから関連データを削除
  if (dtiProductIdsList.length > 0) {
    console.log('Deleting product_performers for DTI products...');
    await db.execute(sql`
      DELETE FROM product_performers
      WHERE product_id IN (
        SELECT DISTINCT product_id FROM product_sources
        WHERE asp_name IN ('カリビアンコムプレミアム', '一本道', 'カリビアンコム', 'HEYZO', 'DTI')
      )
    `);
    console.log('✓ Deleted product_performers');
  }

  // 2.5 product_sourcesから削除
  console.log('Deleting product_sources...');
  await db.execute(sql`
    DELETE FROM product_sources
    WHERE asp_name IN ('カリビアンコムプレミアム', '一本道', 'カリビアンコム', 'HEYZO', 'DTI')
  `);
  console.log('✓ Deleted product_sources');

  // 2.6 孤立したperformersを削除
  console.log('Deleting orphaned performers...');
  await db.execute(sql`
    DELETE FROM performers
    WHERE id NOT IN (SELECT DISTINCT performer_id FROM product_performers)
  `);
  console.log('✓ Deleted orphaned performers');

  // 2.5 孤立したproductsを削除
  console.log('Cleaning up orphaned products...');
  await db.execute(sql`
    DELETE FROM products
    WHERE id NOT IN (SELECT DISTINCT product_id FROM product_sources)
  `);
  console.log('✓ Cleaned up orphaned products');

  // 3. 確認
  console.log('\n=== Verification ===\n');

  const finalRawHtml = await db.execute(sql`
    SELECT COUNT(*) as count FROM raw_html_data
    WHERE source IN ('カリビアンコムプレミアム', '一本道', 'カリビアンコム', 'HEYZO', 'DTI')
  `);
  console.log(`raw_html_data: ${finalRawHtml.rows[0].count} records`);

  const finalProductSources = await db.execute(sql`
    SELECT COUNT(*) as count FROM product_sources
    WHERE asp_name IN ('カリビアンコムプレミアム', '一本道', 'カリビアンコム', 'HEYZO', 'DTI')
  `);
  console.log(`product_sources: ${finalProductSources.rows[0].count} records`);

  const finalProductCache = await db.execute(sql`
    SELECT COUNT(*) as count FROM product_cache
    WHERE asp_name IN ('カリビアンコムプレミアム', '一本道', 'カリビアンコム', 'HEYZO', 'DTI')
  `);
  console.log(`product_cache: ${finalProductCache.rows[0].count} records`);

  const finalProducts = await db.execute(sql`
    SELECT COUNT(*) as count FROM products p
    WHERE EXISTS (
      SELECT 1 FROM product_sources ps
      WHERE ps.product_id = p.id
      AND ps.asp_name IN ('カリビアンコムプレミアム', '一本道', 'カリビアンコム', 'HEYZO', 'DTI')
    )
  `);
  console.log(`DTI products in products table: ${finalProducts.rows[0].count} records`);

  // 4. サンプルチェック - 以前の破損データIDが残っていないか確認
  console.log('\n=== Sample Check ===\n');
  const sampleCheck = await db.execute(sql`
    SELECT id, title FROM products
    WHERE id IN (121078, 121072)
  `);

  if (sampleCheck.rows.length > 0) {
    console.log('⚠ WARNING: Old corrupted product IDs still exist:');
    for (const row of sampleCheck.rows) {
      console.log(`  ID ${row.id}: ${row.title}`);
    }
  } else {
    console.log('✓ Old corrupted product IDs have been removed');
  }

  console.log('\n=== Cleanup Complete ===');
  console.log('Database is now clean. Ready to re-crawl DTI sites.');
}

completeDtiCleanup()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });
