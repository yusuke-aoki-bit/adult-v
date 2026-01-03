import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';

const connectionString = process.env.DATABASE_URL || '';
const url = new URL(connectionString);
const cleanConnectionString = `postgresql://${url.username}:${url.password}@${url.host}${url.pathname}`;

const pool = new Pool({
  connectionString: cleanConnectionString,
  ssl: false,
  max: 2,
});

const db = drizzle(pool);

async function main() {
  const productId = parseInt(process.argv[2] || '1004047', 10);

  const result = await db.execute(sql`
    SELECT id, asp_name, original_product_id, price,
           LEFT(affiliate_url, 80) as affiliate_url_preview
    FROM product_sources
    WHERE product_id = ${productId}
  `);
  console.log(`Sources for product ${productId}:`);
  console.log(JSON.stringify(result.rows || result, null, 2));

  // Also check product_sales with is_active = true only
  const sales = await db.execute(sql`
    SELECT ps.asp_name, s.regular_price, s.sale_price, s.discount_percent, s.is_active
    FROM product_sales s
    JOIN product_sources ps ON s.product_source_id = ps.id
    WHERE ps.product_id = ${productId} AND s.is_active = true
  `);
  console.log(`\nActive sales for product ${productId}:`);
  console.log(JSON.stringify(sales.rows || sales, null, 2));

  // Check getProductSourcesWithSales equivalent (JOIN with is_active = true)
  const combined = await db.execute(sql`
    SELECT
      ps.asp_name,
      ps.original_product_id,
      ps.price,
      COALESCE(s.regular_price, ps.price) as regular_price,
      s.sale_price,
      s.discount_percent,
      s.is_active
    FROM product_sources ps
    LEFT JOIN product_sales s ON s.product_source_id = ps.id AND s.is_active = true
    WHERE ps.product_id = ${productId}
      AND LOWER(ps.asp_name) != 'fanza'
  `);
  console.log(`\nCombined sources with active sales (excluding FANZA):`);
  console.log(JSON.stringify(combined.rows || combined, null, 2));

  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
