import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});
const db = drizzle(pool);

async function main() {
  try {
    // Check product by ID
    const productResult = await db.execute(sql`
      SELECT p.id, p.title, p.original_product_id
      FROM products p
      WHERE p.id = 'officeks-2512'
    `);

    console.log('Product data:');
    console.log(JSON.stringify(productResult.rows, null, 2));

    // Check product_sources
    const sourcesResult = await db.execute(sql`
      SELECT ps.product_id, ps.asp_name, ps.original_product_id
      FROM product_sources ps
      WHERE ps.product_id = 'officeks-2512'
    `);

    console.log('\nProduct sources data:');
    console.log(JSON.stringify(sourcesResult.rows, null, 2));

  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

main();
