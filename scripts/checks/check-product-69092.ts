import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

const db = getDb();

async function checkProduct() {
  console.log('=== 商品ID 69092 の情報 ===\n');

  const result = await db.execute(sql`
    SELECT
      p.id,
      p.normalized_product_id,
      p.title,
      ps.asp_name,
      ps.affiliate_url,
      ps.original_product_id
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    WHERE p.id = 69092
  `);

  console.table(result.rows);

  process.exit(0);
}

checkProduct().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
