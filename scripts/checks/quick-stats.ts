import { getDb } from '../../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  const db = getDb();

  // 動画数統計
  const videoStats = await db.execute(sql`
    SELECT asp_name, COUNT(*) as count
    FROM product_videos
    GROUP BY asp_name
    ORDER BY count DESC
  `);
  console.log('=== サンプル動画数（ASP別）===');
  console.table(videoStats.rows);

  // 総動画数
  const totalVideos = await db.execute(sql`SELECT COUNT(*) as total FROM product_videos`);
  console.log('総サンプル動画数:', totalVideos.rows[0].total);

  // 商品数
  const productStats = await db.execute(sql`
    SELECT asp_name, COUNT(DISTINCT product_id) as count
    FROM product_sources
    GROUP BY asp_name
    ORDER BY count DESC
  `);
  console.log('\n=== 商品数（ASP別）===');
  console.table(productStats.rows);

  // 総商品数
  const totalProducts = await db.execute(sql`SELECT COUNT(*) as total FROM products`);
  console.log('総商品数:', totalProducts.rows[0].total);

  // 画像統計
  const imageStats = await db.execute(sql`
    SELECT
      COUNT(*) as total_products,
      COUNT(CASE WHEN default_thumbnail_url IS NOT NULL AND default_thumbnail_url != '' THEN 1 END) as with_thumbnail,
      COUNT(CASE WHEN default_thumbnail_url IS NULL OR default_thumbnail_url = '' THEN 1 END) as no_thumbnail
    FROM products
  `);
  console.log('\n=== 商品画像状況 ===');
  console.table(imageStats.rows);

  // 女優統計
  const performerStats = await db.execute(sql`
    SELECT
      (SELECT COUNT(*) FROM performers) as total_performers,
      (SELECT COUNT(DISTINCT performer_id) FROM product_performers) as with_products,
      (SELECT COUNT(*) FROM performer_aliases) as total_aliases
  `);
  console.log('\n=== 女優統計 ===');
  console.table(performerStats.rows);

  process.exit(0);
}

main().catch(console.error);
