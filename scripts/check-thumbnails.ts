import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});
const db = drizzle(pool);

async function main() {
  try {
    const result = await db.execute(sql`
      SELECT 
        COUNT(*) as total_products,
        COUNT(default_thumbnail_url) as with_thumb,
        COUNT(*) - COUNT(default_thumbnail_url) as without_thumb
      FROM products
    `);
    
    console.log('=== Products Thumbnail Coverage ===');
    console.log(result.rows[0]);
    
    const performerResult = await db.execute(sql`
      SELECT 
        COUNT(*) as total_performers,
        COUNT(image_url) as with_image,
        COUNT(CASE WHEN image_url IS NULL OR image_url = '' THEN 1 END) as no_image
      FROM performers
    `);
    
    console.log('\n=== Performers Image Coverage ===');
    console.log(performerResult.rows[0]);
    
  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

main();
