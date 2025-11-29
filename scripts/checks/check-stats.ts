import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  const db = getDb();

  // 現状確認
  const stats = await db.execute(sql`
    SELECT
      (SELECT COUNT(*) FROM performers) as total_performers,
      (SELECT COUNT(DISTINCT performer_id) FROM product_performers) as performers_with_products,
      (SELECT COUNT(*) FROM products) as total_products,
      (SELECT COUNT(DISTINCT product_id) FROM product_performers) as products_with_performers
  `);
  console.log('=== データ状況 ===');
  console.table(stats.rows);

  // ASP別の出演者紐付き商品数
  const aspStats = await db.execute(sql`
    SELECT
      ps.asp_name,
      COUNT(DISTINCT ps.product_id) as total_products,
      COUNT(DISTINCT CASE WHEN pp.product_id IS NOT NULL THEN ps.product_id END) as with_performers
    FROM product_sources ps
    LEFT JOIN product_performers pp ON ps.product_id = pp.product_id
    GROUP BY ps.asp_name
    ORDER BY total_products DESC
  `);
  console.log('\n=== ASP別 出演者紐付き状況 ===');
  console.table(aspStats.rows);

  // 商品数が多い出演者TOP20
  const topPerformers = await db.execute(sql`
    SELECT
      p.name,
      COUNT(pp.product_id) as product_count
    FROM performers p
    JOIN product_performers pp ON p.id = pp.performer_id
    WHERE length(p.name) > 1
    GROUP BY p.id, p.name
    ORDER BY product_count DESC
    LIMIT 20
  `);
  console.log('\n=== 商品数TOP20出演者 ===');
  console.table(topPerformers.rows);

  process.exit(0);
}

main().catch(console.error);
