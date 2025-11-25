import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function checkProduct() {
  const db = getDb();

  // Search by DUGA products containing "planet"
  const result = await db.execute(sql`
    SELECT
      p.id,
      p.title,
      p.normalized_product_id,
      ps.original_product_id,
      ps.asp_name
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    WHERE ps.asp_name IN ('DUGA', 'APEX')
      AND (ps.original_product_id LIKE '%planetplus-2364%'
           OR ps.original_product_id LIKE '%ZMAR-148%')
    LIMIT 10
  `);

  console.log('Found products:');
  console.log(JSON.stringify(result.rows, null, 2));
}

checkProduct().then(() => process.exit(0));
