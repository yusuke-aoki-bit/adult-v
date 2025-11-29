import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function checkStats() {
  const db = getDb();

  const result = await db.execute(sql`
    SELECT
      COUNT(*) as total_products,
      COUNT(default_thumbnail_url) as with_thumb,
      COUNT(*) - COUNT(default_thumbnail_url) as without_thumb
    FROM products
  `);

  console.log('Product Thumbnail Statistics:');
  console.log(JSON.stringify(result.rows, null, 2));
  process.exit(0);
}

checkStats();
