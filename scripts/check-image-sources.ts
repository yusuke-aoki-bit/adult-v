import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres';

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  // First check products table columns
  console.log('=== products table columns ===');
  const prodCols = await pool.query(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = 'products' ORDER BY ordinal_position
  `);
  console.log(prodCols.rows.map(r => r.column_name).join(', '));

  // Check product_sources table columns
  console.log('\n=== product_sources columns ===');
  const srcCols = await pool.query(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = 'product_sources' ORDER BY ordinal_position
  `);
  console.log(srcCols.rows.map(r => r.column_name).join(', '));

  // Check product_cache columns
  console.log('\n=== product_cache columns ===');
  const cacheCols = await pool.query(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = 'product_cache' ORDER BY ordinal_position
  `);
  console.log(cacheCols.rows.map(r => r.column_name).join(', '));

  console.log('\n=== product_sources with image ===');
  const sourcesCount = await pool.query(`
    SELECT COUNT(*) as total FROM product_sources WHERE image_url IS NOT NULL
  `);
  console.log(sourcesCount.rows[0]);

  console.log('\n=== Sample product_sources images ===');
  const sampleSources = await pool.query(`
    SELECT product_id, source, image_url
    FROM product_sources
    WHERE image_url IS NOT NULL
    LIMIT 5
  `);
  for (const row of sampleSources.rows) {
    console.log(`  ProductID ${row.product_id} (${row.source}): ${row.image_url?.substring(0, 60)}...`);
  }

  console.log('\n=== product_cache thumbnails by source ===');
  const cacheStats = await pool.query(`
    SELECT
      CASE
        WHEN thumbnail_url LIKE '%duga%' THEN 'DUGA'
        WHEN thumbnail_url LIKE '%dmm%' THEN 'DMM'
        WHEN thumbnail_url LIKE '%sokmil%' THEN 'SOKMIL'
        WHEN thumbnail_url LIKE '%dti%' THEN 'DTI'
        WHEN thumbnail_url IS NULL THEN 'NULL'
        ELSE 'OTHER'
      END as source,
      COUNT(*) as count
    FROM product_cache
    GROUP BY 1
    ORDER BY count DESC
  `);
  console.log(cacheStats.rows);

  await pool.end();
}

main().catch(console.error);
