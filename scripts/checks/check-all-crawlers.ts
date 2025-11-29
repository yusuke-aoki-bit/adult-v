import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  const db = getDb();

  console.log('=== 全クローラ統計 ===\n');

  // ASP別統計
  const aspStats = await db.execute(sql`
    SELECT
      ps.asp_name,
      COUNT(DISTINCT p.id) as products,
      COUNT(DISTINCT CASE WHEN p.default_thumbnail_url IS NOT NULL THEN p.id END) as with_thumb
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    GROUP BY ps.asp_name
    ORDER BY products DESC
  `);

  console.log('ASP別商品数:');
  console.table(aspStats.rows);

  // 画像統計
  const imageStats = await db.execute(sql`
    SELECT
      pi.asp_name,
      COUNT(DISTINCT pi.product_id) as products_with_images,
      COUNT(pi.id) as total_images,
      COUNT(CASE WHEN pi.image_type = 'thumbnail' THEN 1 END) as thumbnails,
      COUNT(CASE WHEN pi.image_type = 'sample' THEN 1 END) as samples
    FROM product_images pi
    GROUP BY pi.asp_name
    ORDER BY total_images DESC
  `);

  console.log('\n画像統計:');
  console.table(imageStats.rows);

  // 演者統計
  const performerStats = await db.execute(sql`
    SELECT
      COUNT(*) as total_performers,
      COUNT(image_url) as with_image,
      COUNT(CASE WHEN image_url IS NULL OR image_url = '' THEN 1 END) as no_image
    FROM performers
  `);

  console.log('\n演者統計:');
  console.table(performerStats.rows);

  // 最近追加された商品
  const recentProducts = await db.execute(sql`
    SELECT
      ps.asp_name,
      p.title,
      p.release_date,
      p.created_at
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    ORDER BY p.created_at DESC
    LIMIT 10
  `);

  console.log('\n最近追加された商品:');
  console.table(recentProducts.rows);

  process.exit(0);
}

main().catch((error) => {
  console.error('エラー:', error);
  process.exit(1);
});
