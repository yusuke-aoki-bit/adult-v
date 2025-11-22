import { Pool } from 'pg';
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres';
const pool = new Pool({ connectionString: DATABASE_URL });

async function main() {
  // performersテーブルの構造を確認
  const cols = await pool.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'performers'
    ORDER BY ordinal_position
  `);
  console.log('=== performers テーブル構造 ===');
  cols.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));

  // サムネイル状況
  const stats = await pool.query(`
    SELECT
      COUNT(*) as total,
      COUNT(thumbnail_url) as with_thumb
    FROM performers
  `);
  console.log('\n=== performers サムネイル状況 ===');
  console.log(stats.rows[0]);

  // サンプル
  const samples = await pool.query(`
    SELECT id, name, thumbnail_url
    FROM performers
    LIMIT 10
  `);
  console.log('\n=== サンプル ===');
  samples.rows.forEach(r => {
    console.log(`  ${r.id}: ${r.name} -> ${r.thumbnail_url || 'NULL'}`);
  });

  await pool.end();
}
main().catch(console.error);
