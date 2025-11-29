import { getDb } from '../../lib/db';
import { sql } from 'drizzle-orm';

const db = getDb();

async function main() {
  // ASP別の商品数
  const aspStats = await db.execute(sql`
    SELECT 
      asp_name,
      COUNT(DISTINCT product_id) as product_count
    FROM product_sources
    GROUP BY asp_name
    ORDER BY product_count DESC
  `);

  console.log('=== ASP別 収集済み商品数 ===');
  console.table(aspStats.rows);

  // 総商品数
  const total = await db.execute(sql`SELECT COUNT(*) as total FROM products`);
  console.log('\n総商品数:', (total.rows[0] as any).total);

  process.exit(0);
}

main().catch(console.error);
