import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  const db = getDb();

  // ASP別収集状況
  const stats = await db.execute(sql`
    SELECT
      ps.asp_name,
      COUNT(DISTINCT ps.product_id) as total,
      ROUND(COUNT(DISTINCT CASE WHEN p.default_thumbnail_url IS NOT NULL AND p.default_thumbnail_url != '' AND p.default_thumbnail_url NOT LIKE '%placehold%' THEN ps.product_id END)::numeric / NULLIF(COUNT(DISTINCT ps.product_id), 0) * 100, 1) as img_pct,
      ROUND(COUNT(DISTINCT pv.product_id)::numeric / NULLIF(COUNT(DISTINCT ps.product_id), 0) * 100, 1) as vid_pct,
      ROUND(COUNT(DISTINCT pp.product_id)::numeric / NULLIF(COUNT(DISTINCT ps.product_id), 0) * 100, 1) as perf_pct
    FROM product_sources ps
    JOIN products p ON ps.product_id = p.id
    LEFT JOIN product_videos pv ON ps.product_id = pv.product_id
    LEFT JOIN product_performers pp ON ps.product_id = pp.product_id
    GROUP BY ps.asp_name
    ORDER BY total DESC
  `);

  console.log('\n=== ASP別収集状況 ===');
  console.table(stats.rows);

  // 総数
  const totals = await db.execute(sql`
    SELECT
      (SELECT COUNT(*) FROM products) as products,
      (SELECT COUNT(*) FROM performers) as performers,
      (SELECT COUNT(*) FROM product_videos) as videos,
      (SELECT COUNT(*) FROM product_performers) as links
  `);
  console.log('\n=== 総数 ===');
  console.table(totals.rows);

  process.exit(0);
}

main().catch(console.error);
