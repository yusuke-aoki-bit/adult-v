/**
 * product_cacheにサムネイルURLを登録するスクリプト
 * affiliate_urlからサムネイルURLを推測して登録
 */
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres';

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  // 現状確認
  console.log('=== 現状確認 ===');
  const stats = await pool.query(`
    SELECT
      COUNT(*) as total,
      COUNT(thumbnail_url) as with_thumbnail,
      COUNT(CASE WHEN asp_name = 'DMM' THEN 1 END) as dmm_count,
      COUNT(CASE WHEN asp_name = 'DUGA' THEN 1 END) as duga_count,
      COUNT(CASE WHEN asp_name = 'SOKMIL' THEN 1 END) as sokmil_count,
      COUNT(CASE WHEN asp_name = 'DTI' THEN 1 END) as dti_count
    FROM product_cache
  `);
  console.log(stats.rows[0]);

  // サムネイルURLの既存サンプルを確認
  console.log('\n=== 既存サムネイルURL サンプル ===');
  const existingSamples = await pool.query(`
    SELECT id, product_id, asp_name, thumbnail_url, affiliate_url
    FROM product_cache
    WHERE thumbnail_url IS NOT NULL
    LIMIT 10
  `);
  for (const row of existingSamples.rows) {
    console.log(`  ${row.asp_name}: ${row.thumbnail_url?.substring(0, 80)}...`);
  }

  // サムネイルがない例を見る
  console.log('\n=== サムネイルなしサンプル（affiliate_url確認） ===');
  const noThumbSamples = await pool.query(`
    SELECT id, product_id, asp_name, affiliate_url
    FROM product_cache
    WHERE thumbnail_url IS NULL
    LIMIT 20
  `);
  for (const row of noThumbSamples.rows) {
    console.log(`  ${row.asp_name}: ${row.affiliate_url?.substring(0, 100)}...`);
  }

  // raw_csv_dataがあれば確認
  console.log('\n=== raw_csv_data テーブル確認 ===');
  const rawCsvCols = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'raw_csv_data' ORDER BY ordinal_position
  `);
  if (rawCsvCols.rowCount && rawCsvCols.rowCount > 0) {
    console.log('Columns:', rawCsvCols.rows.map(r => r.column_name).join(', '));

    const rawSample = await pool.query(`SELECT * FROM raw_csv_data LIMIT 3`);
    console.log('Sample rows:', rawSample.rows.length);
    if (rawSample.rows[0]) {
      console.log('First row keys:', Object.keys(rawSample.rows[0]).join(', '));
    }
  } else {
    console.log('raw_csv_data テーブルが存在しないか、空です');
  }

  await pool.end();
}

main().catch(console.error);
