import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres';

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  console.log('=== product_cache thumbnails ===');
  const cacheResult = await pool.query(`
    SELECT product_id, thumbnail_url
    FROM product_cache
    LIMIT 10
  `);
  console.log('Total rows:', cacheResult.rowCount);
  for (const row of cacheResult.rows) {
    console.log(`  ID ${row.product_id}: ${row.thumbnail_url || 'NULL'}`);
  }

  console.log('\n=== Count stats ===');
  const countResult = await pool.query(`
    SELECT
      COUNT(*) as total,
      COUNT(thumbnail_url) as with_thumbnail
    FROM product_cache
  `);
  console.log(countResult.rows[0]);

  await pool.end();
}

main().catch(console.error);
