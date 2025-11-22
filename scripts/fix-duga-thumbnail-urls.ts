/**
 * DUGAのサムネイルURLを正しい形式に修正
 * 現在: https://pic.duga.jp/ppv/glory-4703/noauth/jacket.jpg
 * 正解: https://pic.duga.jp/unsecure/glory/4703/noauth/jacket_240.jpg
 */
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres';

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  console.log('=== DUGA サムネイルURL修正 ===\n');

  // 現在のサムネイルを確認
  const sampleBefore = await pool.query(`
    SELECT thumbnail_url
    FROM product_cache
    WHERE asp_name = 'DUGA' AND thumbnail_url IS NOT NULL
    LIMIT 5
  `);
  console.log('修正前サンプル:');
  for (const row of sampleBefore.rows) {
    console.log(`  ${row.thumbnail_url}`);
  }

  // URLを修正
  // glory-4703 → glory/4703
  // ppv → unsecure
  // jacket.jpg → jacket_240.jpg
  const updateResult = await pool.query(`
    UPDATE product_cache
    SET thumbnail_url =
      'https://pic.duga.jp/unsecure/' ||
      regexp_replace(
        regexp_replace(thumbnail_url, 'https://pic.duga.jp/ppv/', ''),
        '-([0-9]+)/noauth/jacket.jpg',
        '/\\1/noauth/jacket_240.jpg'
      )
    WHERE asp_name = 'DUGA'
      AND thumbnail_url LIKE 'https://pic.duga.jp/ppv/%'
    RETURNING id
  `);

  console.log(`\nUpdated ${updateResult.rowCount} rows`);

  // 修正後確認
  const sampleAfter = await pool.query(`
    SELECT thumbnail_url
    FROM product_cache
    WHERE asp_name = 'DUGA' AND thumbnail_url IS NOT NULL
    LIMIT 5
  `);
  console.log('\n修正後サンプル:');
  for (const row of sampleAfter.rows) {
    console.log(`  ${row.thumbnail_url}`);
  }

  await pool.end();
}

main().catch(console.error);
