import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  const db = getDb();

  // セール情報を確認
  const salesData = await db.execute(sql`
    SELECT
      ps.id as sale_id,
      pso.original_product_id,
      pso.asp_name,
      ps.regular_price,
      ps.sale_price,
      ps.discount_percent,
      ps.sale_name,
      ps.is_active,
      ps.created_at
    FROM product_sales ps
    INNER JOIN product_sources pso ON ps.product_source_id = pso.id
    ORDER BY ps.created_at DESC
    LIMIT 15
  `);

  console.log('=== 最新のセール情報 ===');
  console.table(salesData.rows);

  // ASP別のセール数
  const saleCounts = await db.execute(sql`
    SELECT
      pso.asp_name,
      COUNT(*) as count,
      SUM(CASE WHEN ps.is_active THEN 1 ELSE 0 END) as active_count
    FROM product_sales ps
    INNER JOIN product_sources pso ON ps.product_source_id = pso.id
    GROUP BY pso.asp_name
    ORDER BY count DESC
  `);

  console.log('\n=== ASP別セール数 ===');
  console.table(saleCounts.rows);

  process.exit(0);
}

main().catch(console.error);
