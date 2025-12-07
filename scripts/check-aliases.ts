import { db } from '../lib/db';
import { performerAliases, performers } from '../lib/db/schema';
import { eq, sql } from 'drizzle-orm';

async function main() {
  // セール中の作品のASP分布を確認
  const salesByAsp = await db.execute(sql`
    SELECT ps.asp_name, COUNT(*) as count
    FROM product_sales psl
    JOIN product_sources ps ON ps.id = psl.product_source_id
    WHERE psl.is_active = true
    AND (psl.end_at IS NULL OR psl.end_at > NOW())
    GROUP BY ps.asp_name
    ORDER BY count DESC
  `);
  console.log('=== Active Sales by ASP ===');
  for (const row of salesByAsp.rows) {
    console.log(`${row.asp_name}: ${row.count}`);
  }

  // セール価格のサンプルを確認
  const sampleSales = await db.execute(sql`
    SELECT p.title, ps.asp_name, psl.regular_price, psl.sale_price, psl.discount_percent
    FROM product_sales psl
    JOIN product_sources ps ON ps.id = psl.product_source_id
    JOIN products p ON p.id = ps.product_id
    WHERE psl.is_active = true
    AND (psl.end_at IS NULL OR psl.end_at > NOW())
    LIMIT 10
  `);
  console.log('\n=== Sample Sale Products ===');
  for (const row of sampleSales.rows) {
    console.log(`${row.title} (${row.asp_name}): ¥${row.regular_price} -> ¥${row.sale_price} (${row.discount_percent}% OFF)`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
