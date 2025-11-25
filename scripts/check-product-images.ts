import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});
const db = drizzle(pool);

async function main() {
  try {
    const result = await db.execute(sql`SELECT COUNT(*) as total FROM product_images`);
    console.log('=== product_images table ===');
    console.log('Total records:', result.rows[0]?.total || '0');

    const samples = await db.execute(sql`SELECT product_id, image_type, image_url FROM product_images LIMIT 5`);

    console.log('\nSample records:');
    for (const row of samples.rows) {
      console.log(`  Product ${row.product_id} (${row.image_type}): ${row.image_url}`);
    }

    if (samples.rows.length === 0) {
      console.log('  (No records found - table is empty)');
    }

  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

main();
