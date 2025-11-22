/**
 * サムネイルURLのプロトコルを修正
 * //www.heyzo.com/... → https://www.heyzo.com/...
 */
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres';

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  console.log('=== プロトコル相対URLを修正 ===\n');

  // //で始まるURLを確認
  const checkResult = await pool.query(`
    SELECT COUNT(*) as count
    FROM product_cache
    WHERE thumbnail_url LIKE '//%'
  `);
  console.log(`Protocol-relative URLs found: ${checkResult.rows[0].count}`);

  // https://に修正
  const updateResult = await pool.query(`
    UPDATE product_cache
    SET thumbnail_url = 'https:' || thumbnail_url
    WHERE thumbnail_url LIKE '//%'
    RETURNING id
  `);
  console.log(`Updated ${updateResult.rowCount} rows`);

  // 結果確認
  console.log('\n=== 更新後サンプル ===');
  const samples = await pool.query(`
    SELECT thumbnail_url
    FROM product_cache
    WHERE asp_name = 'DTI' AND thumbnail_url IS NOT NULL
    LIMIT 5
  `);
  for (const row of samples.rows) {
    console.log(`  ${row.thumbnail_url}`);
  }

  await pool.end();
}

main().catch(console.error);
