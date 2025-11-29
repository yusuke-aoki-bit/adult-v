import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function checkProduct() {
  const db = getDb();

  // Search by original_product_id
  const result = await db.execute(sql`
    SELECT
      p.id,
      p.title,
      ps.original_product_id,
      ps.asp_name,
      ps.maker_product_code
    FROM product_sources ps
    JOIN products p ON ps.product_id = p.id
    WHERE ps.original_product_id = 'planetplus-2364'
       OR ps.original_product_id = 'ZMAR-148'
  `);

  console.log('Product data:');
  console.log(JSON.stringify(result.rows, null, 2));
}

checkProduct().then(() => process.exit(0));
