import { db } from '../packages/crawlers/src/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('=== MGS データ品質チェック ===\n');

  // 1. MGS商品の総数
  const totalCount = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM product_sources
    WHERE asp_name = 'MGS'
  `);
  console.log(`📊 MGS商品総数: ${totalCount.rows[0].count}`);

  // 2. product_type別
  const byType = await db.execute(sql`
    SELECT product_type, COUNT(*) as count
    FROM product_sources
    WHERE asp_name = 'MGS'
    GROUP BY product_type
  `);
  console.log('\n📊 product_type別:');
  for (const r of byType.rows) {
    console.log(`  ${r.product_type || '(null)'}: ${r.count}`);
  }

  // 3. タイトルが空または無効な商品
  const invalidTitles = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    WHERE ps.asp_name = 'MGS'
    AND (p.title IS NULL OR p.title = '' OR p.title LIKE '%エロ動画・アダルトビデオ%')
  `);
  console.log(`\n⚠️ 無効なタイトルの商品: ${invalidTitles.rows[0].count}`);

  // 4. サンプルを表示
  if (Number(invalidTitles.rows[0].count) > 0) {
    const samples = await db.execute(sql`
      SELECT ps.original_product_id, p.title
      FROM products p
      JOIN product_sources ps ON p.id = ps.product_id
      WHERE ps.asp_name = 'MGS'
      AND (p.title IS NULL OR p.title = '' OR p.title LIKE '%エロ動画・アダルトビデオ%')
      LIMIT 10
    `);
    console.log('\n  サンプル（最大10件）:');
    for (const r of samples.rows) {
      console.log(`    ${r.original_product_id}: ${r.title?.toString().slice(0, 50)}`);
    }
  }

  // 5. raw_html_dataとの整合性
  const rawCount = await db.execute(sql`
    SELECT COUNT(*) as count FROM raw_html_data WHERE source = 'MGS'
  `);
  console.log(`\n📊 raw_html_data MGS件数: ${rawCount.rows[0].count}`);

  // 6. raw_html_dataにあってproduct_sourcesにない
  const rawOnly = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM raw_html_data r
    WHERE r.source = 'MGS'
    AND NOT EXISTS (
      SELECT 1 FROM product_sources ps
      WHERE ps.asp_name = 'MGS' AND ps.original_product_id = r.product_id
    )
  `);
  console.log(`  raw_html_dataのみ: ${rawOnly.rows[0].count}`);

  // 7. 重複チェック
  const duplicates = await db.execute(sql`
    SELECT original_product_id, COUNT(*) as count
    FROM product_sources
    WHERE asp_name = 'MGS'
    GROUP BY original_product_id
    HAVING COUNT(*) > 1
    LIMIT 10
  `);
  console.log(`\n📊 重複商品数: ${duplicates.rows.length}`);
  if (duplicates.rows.length > 0) {
    for (const r of duplicates.rows) {
      console.log(`  ${r.original_product_id}: ${r.count}件`);
    }
  }

  // 8. 価格データの確認
  const priceStats = await db.execute(sql`
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN price IS NOT NULL AND price > 0 THEN 1 END) as with_price,
      COUNT(CASE WHEN price IS NULL OR price = 0 THEN 1 END) as no_price
    FROM product_sources
    WHERE asp_name = 'MGS'
  `);
  console.log('\n📊 価格データ:');
  console.log(`  価格あり: ${priceStats.rows[0].with_price}`);
  console.log(`  価格なし: ${priceStats.rows[0].no_price}`);

  // 9. 画像データの確認
  const imageStats = await db.execute(sql`
    SELECT
      COUNT(DISTINCT ps.product_id) as products_with_images
    FROM product_sources ps
    JOIN product_images pi ON ps.product_id = pi.product_id
    WHERE ps.asp_name = 'MGS'
  `);
  console.log(`\n📊 画像データ: ${imageStats.rows[0].products_with_images}商品に画像あり`);

  // 10. 動画データの確認
  const videoStats = await db.execute(sql`
    SELECT
      COUNT(DISTINCT ps.product_id) as products_with_videos
    FROM product_sources ps
    JOIN product_videos pv ON ps.product_id = pv.product_id
    WHERE ps.asp_name = 'MGS'
  `);
  console.log(`📊 動画データ: ${videoStats.rows[0].products_with_videos}商品に動画あり`);

  // 11. 期待される総数との差分
  const expectedCount = 120 * 84; // 120件/ページ × 84ページ
  const actualCount = Number(totalCount.rows[0].count);
  console.log(`\n📊 期待される件数との比較:`);
  console.log(`  サイト上の推定件数: ~${expectedCount.toLocaleString()} (120件×84ページ)`);
  console.log(`  DB上の件数: ${actualCount.toLocaleString()}`);
  console.log(`  差分: ${(actualCount - expectedCount).toLocaleString()}`);

  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
