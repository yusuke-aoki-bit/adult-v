import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});
const db = drizzle(pool);

async function main() {
  try {
    const result = await db.execute(sql`
      SELECT pi.id, pi.product_id, pi.image_url, pi.image_type, pi.asp_name, pi.display_order
      FROM product_images pi
      WHERE pi.product_id = 97318
      ORDER BY pi.display_order, pi.id
    `);

    console.log('Product 97318 images:');
    console.log(JSON.stringify(result.rows, null, 2));

    // Also check the product info
    const productResult = await db.execute(sql`
      SELECT p.id, p.title, p.default_thumbnail_url
      FROM products p
      WHERE p.id = 97318
    `);

    console.log('\nProduct info:');
    console.log(JSON.stringify(productResult.rows, null, 2));

  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

main();
