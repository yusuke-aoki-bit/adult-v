import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});
const db = drizzle(pool);

async function main() {
  try {
    // Check performers
    const performerStats = await db.execute(sql`
      SELECT
        COUNT(*) as total,
        COUNT(profile_image_url) as with_image,
        COUNT(CASE WHEN profile_image_url IS NULL OR profile_image_url = '' THEN 1 END) as no_image
      FROM performers
    `);

    console.log('=== Performer Images ===');
    console.log(performerStats.rows[0]);

    // Check products
    const productStats = await db.execute(sql`
      SELECT
        COUNT(*) as total,
        COUNT(default_thumbnail_url) as with_thumb,
        COUNT(CASE WHEN default_thumbnail_url IS NULL OR default_thumbnail_url = '' THEN 1 END) as no_thumb
      FROM products
    `);

    console.log('\n=== Product Thumbnails ===');
    console.log(productStats.rows[0]);

    // Sample performers with images
    const sampleWithImages = await db.execute(sql`
      SELECT id, name, profile_image_url
      FROM performers
      WHERE profile_image_url IS NOT NULL AND profile_image_url != ''
      LIMIT 5
    `);

    console.log('\n=== Sample Performers WITH Images ===');
    for (const row of sampleWithImages.rows) {
      console.log(`${row.id}: ${row.name} -> ${row.profile_image_url}`);
    }

    // Sample performers without images
    const sampleWithoutImages = await db.execute(sql`
      SELECT id, name, profile_image_url
      FROM performers
      WHERE profile_image_url IS NULL OR profile_image_url = ''
      LIMIT 5
    `);

    console.log('\n=== Sample Performers WITHOUT Images ===');
    for (const row of sampleWithoutImages.rows) {
      console.log(`${row.id}: ${row.name} -> ${row.profile_image_url || 'NULL'}`);
    }

    // Check product_cache for thumbnails
    const cacheStats = await db.execute(sql`
      SELECT
        COUNT(*) as total,
        COUNT(thumbnail_url) as with_thumb,
        COUNT(CASE WHEN thumbnail_url IS NULL OR thumbnail_url = '' THEN 1 END) as no_thumb,
        COUNT(sample_images) as with_samples
      FROM product_cache
    `);

    console.log('\n=== Product Cache Thumbnails ===');
    console.log(cacheStats.rows[0]);

    // Sample products with thumbnails in cache
    const sampleCache = await db.execute(sql`
      SELECT product_id, asp_name, thumbnail_url, sample_images
      FROM product_cache
      WHERE thumbnail_url IS NOT NULL AND thumbnail_url != ''
      LIMIT 3
    `);

    console.log('\n=== Sample Products WITH Thumbnails (from cache) ===');
    for (const row of sampleCache.rows) {
      console.log(`Product ${row.product_id} (${row.asp_name}): ${row.thumbnail_url}`);
      if (row.sample_images) {
        const samples = Array.isArray(row.sample_images) ? row.sample_images : JSON.parse(row.sample_images);
        console.log(`  Sample images: ${samples.length} found`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

main();
