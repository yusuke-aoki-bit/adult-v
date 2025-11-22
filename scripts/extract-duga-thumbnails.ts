/**
 * raw_csv_dataからDUGAのサムネイルURLを抽出してproduct_cacheに登録
 */
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres';

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  // raw_csv_dataのサンプルを確認
  console.log('=== raw_csv_data サンプル確認 ===');
  const sample = await pool.query(`
    SELECT id, source, product_id, raw_data
    FROM raw_csv_data
    WHERE source = 'DUGA'
    LIMIT 3
  `);

  if (sample.rows.length === 0) {
    console.log('DUGA data not found in raw_csv_data');

    // 他のsourceを確認
    const sources = await pool.query(`SELECT DISTINCT source FROM raw_csv_data`);
    console.log('Available sources:', sources.rows.map(r => r.source).join(', '));
    await pool.end();
    return;
  }

  for (const row of sample.rows) {
    console.log(`\nID: ${row.id}, product_id: ${row.product_id}`);
    const rawData = row.raw_data;
    if (typeof rawData === 'object') {
      console.log('Keys:', Object.keys(rawData).join(', '));
      // 画像関連のキーを探す
      const imageKeys = Object.keys(rawData).filter(k =>
        k.toLowerCase().includes('image') ||
        k.toLowerCase().includes('thumb') ||
        k.toLowerCase().includes('photo') ||
        k.toLowerCase().includes('jacket')
      );
      console.log('Image-related keys:', imageKeys);
      for (const key of imageKeys) {
        console.log(`  ${key}: ${rawData[key]}`);
      }
    }
  }

  // サムネイル更新を実行
  console.log('\n=== サムネイル更新開始 ===');

  // raw_csv_dataからサムネイルURLを取得してproduct_cacheを更新
  const updateResult = await pool.query(`
    WITH thumbnail_data AS (
      SELECT
        r.product_id::integer as pid,
        COALESCE(
          r.raw_data->>'jacketimage',
          r.raw_data->>'image',
          r.raw_data->>'thumbnail',
          r.raw_data->>'jacket_image',
          r.raw_data->>'thumb'
        ) as thumb_url
      FROM raw_csv_data r
      WHERE r.source = 'DUGA'
        AND (r.raw_data->>'jacketimage' IS NOT NULL
             OR r.raw_data->>'image' IS NOT NULL
             OR r.raw_data->>'thumbnail' IS NOT NULL
             OR r.raw_data->>'jacket_image' IS NOT NULL
             OR r.raw_data->>'thumb' IS NOT NULL)
    )
    UPDATE product_cache pc
    SET thumbnail_url = td.thumb_url
    FROM thumbnail_data td
    WHERE pc.product_id = td.pid
      AND pc.thumbnail_url IS NULL
      AND td.thumb_url IS NOT NULL
    RETURNING pc.id
  `);

  console.log(`Updated ${updateResult.rowCount} rows`);

  // 結果確認
  const finalStats = await pool.query(`
    SELECT
      COUNT(*) as total,
      COUNT(thumbnail_url) as with_thumbnail
    FROM product_cache
    WHERE asp_name = 'DUGA'
  `);
  console.log('\n=== DUGA サムネイル状況 ===');
  console.log(finalStats.rows[0]);

  await pool.end();
}

main().catch(console.error);
