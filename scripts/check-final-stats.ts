import { Pool } from 'pg';
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres';
const pool = new Pool({ connectionString: DATABASE_URL });

async function main() {
  const stats = await pool.query(`
    SELECT
      asp_name,
      COUNT(*) as total,
      COUNT(thumbnail_url) as with_thumbnail
    FROM product_cache
    GROUP BY asp_name
  `);
  console.log('=== サムネイル状況 (ASP別) ===');
  console.log(stats.rows);

  const overall = await pool.query(`
    SELECT
      COUNT(*) as total,
      COUNT(thumbnail_url) as with_thumbnail
    FROM product_cache
  `);
  console.log('\n=== 全体 ===');
  console.log(overall.rows[0]);
  await pool.end();
}
main().catch(console.error);
