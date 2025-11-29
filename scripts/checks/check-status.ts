import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  const db = getDb();

  console.log('=== 現在のデータ状況 ===\n');

  // サンプル動画数（ASP別）
  const videos = await db.execute(sql`
    SELECT asp_name, COUNT(*) as count
    FROM product_videos
    GROUP BY asp_name
    ORDER BY count DESC
  `);
  console.log('📹 サンプル動画数（ASP別）:');
  console.table(videos.rows);

  const totalVideos = await db.execute(sql`
    SELECT COUNT(*) as total FROM product_videos
  `);
  console.log(`総動画数: ${totalVideos.rows[0].total}\n`);

  // 商品数（ASP別）
  const products = await db.execute(sql`
    SELECT asp_name, COUNT(DISTINCT product_id) as count
    FROM product_sources
    GROUP BY asp_name
    ORDER BY count DESC
  `);
  console.log('📦 商品数（ASP別）:');
  console.table(products.rows);

  const totalProducts = await db.execute(sql`
    SELECT COUNT(*) as total FROM products
  `);
  console.log(`総商品数: ${totalProducts.rows[0].total}\n`);

  // 動画カバー率（ASP別）
  console.log('📊 サンプル動画カバー率:');
  const coverage = await db.execute(sql`
    SELECT
      ps.asp_name,
      COUNT(DISTINCT ps.product_id) as total_products,
      COUNT(DISTINCT pv.product_id) as products_with_video,
      ROUND(100.0 * COUNT(DISTINCT pv.product_id) / NULLIF(COUNT(DISTINCT ps.product_id), 0), 1) as coverage_pct
    FROM product_sources ps
    LEFT JOIN product_videos pv ON ps.product_id = pv.product_id AND ps.asp_name = pv.asp_name
    GROUP BY ps.asp_name
    ORDER BY coverage_pct DESC NULLS LAST
  `);
  console.table(coverage.rows);

  process.exit(0);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
