import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function checkThumbnails() {
  const db = getDb();

  const result = await db.execute(sql`
    SELECT
      COUNT(*) as total_cache,
      COUNT(thumbnail_url) as with_thumb,
      COUNT(*) - COUNT(thumbnail_url) as without_thumb,
      COUNT(DISTINCT asp_name) as asp_count
    FROM product_cache
  `);

  console.log('Product Cache Thumbnail Statistics:');
  console.log(JSON.stringify(result.rows, null, 2));

  // Sample thumbnails by ASP
  const samples = await db.execute(sql`
    SELECT asp_name, COUNT(*) as total, COUNT(thumbnail_url) as with_thumb
    FROM product_cache
    GROUP BY asp_name
    ORDER BY total DESC
  `);

  console.log('\nThumbnails by ASP:');
  console.log(JSON.stringify(samples.rows, null, 2));

  process.exit(0);
}

checkThumbnails();
