import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function checkProduct() {
  const db = getDb();

  // Check product with planetplus-2364
  const result = await db.execute(sql`
    SELECT
      p.id,
      p.title,
      ps.original_product_id,
      ps.asp_name
    FROM products p
    LEFT JOIN product_sources ps ON p.id = ps.product_id
    WHERE p.id = 'planetplus-2364'
       OR ps.original_product_id = 'planetplus-2364'
       OR ps.original_product_id = 'ZMAR-148'
  `);

  console.log('Product data:');
  console.log(JSON.stringify(result.rows, null, 2));
}

checkProduct().then(() => process.exit(0));
