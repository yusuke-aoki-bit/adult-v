import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function analyzeTables() {
  const db = getDb();

  console.log('=== Database Table Analysis ===\n');

  // Get all tables
  const tables = await db.execute(sql`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `);

  console.log('Available tables:');
  for (const table of tables.rows) {
    const tableName = (table as any).tablename;

    // Get row count
    const countResult = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM ${tableName}`));
    const count = (countResult.rows[0] as any).count;

    // Get table size
    const sizeResult = await db.execute(sql.raw(`
      SELECT pg_size_pretty(pg_total_relation_size('${tableName}')) as size
    `));
    const size = (sizeResult.rows[0] as any).size;

    console.log(`  ${tableName}: ${count} rows, ${size}`);
  }

  console.log('\n=== Detailed Table Information ===\n');

  // Check raw_html_data
  console.log('raw_html_data:');
  const htmlSources = await db.execute(sql`
    SELECT source, COUNT(*) as count
    FROM raw_html_data
    GROUP BY source
    ORDER BY count DESC
  `);
  console.log('  Sources:', JSON.stringify(htmlSources.rows, null, 2));

  // Check raw_csv_data
  console.log('\nraw_csv_data:');
  const csvSources = await db.execute(sql`
    SELECT source, COUNT(*) as count
    FROM raw_csv_data
    GROUP BY source
    ORDER BY count DESC
  `);
  console.log('  Sources:', JSON.stringify(csvSources.rows, null, 2));

  // Check product_sources
  console.log('\nproduct_sources:');
  const aspNames = await db.execute(sql`
    SELECT asp_name, COUNT(*) as count
    FROM product_sources
    GROUP BY asp_name
    ORDER BY count DESC
  `);
  console.log('  ASP Names:', JSON.stringify(aspNames.rows, null, 2));

  // Check products with/without thumbnails
  console.log('\nproducts:');
  const thumbStats = await db.execute(sql`
    SELECT
      COUNT(*) as total,
      COUNT(default_thumbnail_url) as with_thumb,
      COUNT(*) - COUNT(default_thumbnail_url) as without_thumb
    FROM products
  `);
  console.log('  Thumbnail stats:', JSON.stringify(thumbStats.rows, null, 2));

  // Check product_images
  console.log('\nproduct_images:');
  const imageStats = await db.execute(sql`
    SELECT COUNT(*) as total FROM product_images
  `);
  console.log('  Total images:', JSON.stringify(imageStats.rows, null, 2));

  // Check product_videos
  console.log('\nproduct_videos:');
  const videoStats = await db.execute(sql`
    SELECT COUNT(*) as total FROM product_videos
  `);
  console.log('  Total videos:', JSON.stringify(videoStats.rows, null, 2));

  // Check performer_images
  console.log('\nperformer_images:');
  const performerImageStats = await db.execute(sql`
    SELECT COUNT(*) as total FROM performer_images
  `);
  console.log('  Total performer images:', JSON.stringify(performerImageStats.rows, null, 2));

  process.exit(0);
}

analyzeTables();
