import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function checkImages() {
  const db = getDb();

  // Check product_images table structure and data
  const columns = await db.execute(sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'product_images'
    ORDER BY ordinal_position
  `);

  console.log('product_images table structure:');
  console.log(JSON.stringify(columns.rows, null, 2));

  // Check how many images exist
  const stats = await db.execute(sql`
    SELECT
      COUNT(*) as total_images,
      COUNT(DISTINCT product_id) as products_with_images
    FROM product_images
  `);

  console.log('\nImage statistics:');
  console.log(JSON.stringify(stats.rows, null, 2));

  // Sample some images
  const samples = await db.execute(sql`
    SELECT *
    FROM product_images
    LIMIT 5
  `);

  console.log('\nSample images:');
  console.log(JSON.stringify(samples.rows, null, 2));

  process.exit(0);
}

checkImages();
