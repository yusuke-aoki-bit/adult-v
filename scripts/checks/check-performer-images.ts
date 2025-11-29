import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  const db = getDb();

  console.log('=== Performer Image Statistics ===\n');

  // Total performers
  const totalPerformers = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM performers
  `);
  console.log(`Total performers: ${totalPerformers.rows[0].count}`);

  // Performers with images
  const withImages = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM performers
    WHERE image_url IS NOT NULL AND image_url != ''
  `);
  console.log(`Performers with images: ${withImages.rows[0].count}`);

  // Performers without images
  const withoutImages = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM performers
    WHERE image_url IS NULL OR image_url = ''
  `);
  console.log(`Performers without images: ${withoutImages.rows[0].count}`);

  // Sample performers without images
  console.log('\n=== Sample Performers Without Images ===\n');
  const samples = await db.execute(sql`
    SELECT id, name, name_en
    FROM performers
    WHERE image_url IS NULL OR image_url = ''
    ORDER BY id
    LIMIT 10
  `);

  console.table(samples.rows);

  // Check if performers have product associations
  console.log('\n=== Performer Associations ===\n');
  const associations = await db.execute(sql`
    SELECT
      COUNT(DISTINCT pp.performer_id) as performers_with_products
    FROM performers p
    LEFT JOIN product_performers pp ON p.id = pp.performer_id
    WHERE p.image_url IS NULL OR p.image_url = ''
  `);

  console.table(associations.rows);

  process.exit(0);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
