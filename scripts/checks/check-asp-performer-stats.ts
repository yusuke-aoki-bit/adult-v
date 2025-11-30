import { getDb } from '../../lib/db';
import { sql } from 'drizzle-orm';

const db = getDb();

async function main() {
  const r = await db.execute(sql`
    SELECT
      ps.asp_name,
      COUNT(DISTINCT ps.product_id) as total,
      COUNT(DISTINCT CASE WHEN pp.product_id IS NOT NULL THEN ps.product_id END) as linked,
      ROUND(100.0 * COUNT(DISTINCT CASE WHEN pp.product_id IS NOT NULL THEN ps.product_id END) / NULLIF(COUNT(DISTINCT ps.product_id), 0), 1) as rate
    FROM product_sources ps
    LEFT JOIN product_performers pp ON ps.product_id = pp.product_id
    GROUP BY ps.asp_name
    ORDER BY total DESC
  `);
  console.log('=== ASP別出演者紐付け状況 ===');
  console.table(r.rows);

  const total = await db.execute(sql`
    SELECT
      COUNT(DISTINCT p.id) as total_products,
      COUNT(DISTINCT pp.performer_id) as unique_performers,
      COUNT(*) FILTER (WHERE pp.product_id IS NOT NULL) as total_links
    FROM products p
    LEFT JOIN product_performers pp ON p.id = pp.product_id
  `);
  console.log('\n=== 全体統計 ===');
  console.table(total.rows);

  process.exit(0);
}

main();
