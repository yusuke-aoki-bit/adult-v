/**
 * DUGAのサムネイルURLを正しい形式に再修正
 * 現在: https://pic.duga.jp/unsecure/fetishjapan/0449/noauth/jacket_240.jpg (一部404)
 * DBに再度affiliate_urlから正しく生成
 */
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres';

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  console.log('=== DUGA サムネイルURL再修正 ===\n');

  // 現在のサムネイルURLを確認
  const sampleBefore = await pool.query(`
    SELECT thumbnail_url, affiliate_url
    FROM product_cache
    WHERE asp_name = 'DUGA' AND thumbnail_url IS NOT NULL
    LIMIT 5
  `);
  console.log('現在のサムネイル:');
  for (const row of sampleBefore.rows) {
    console.log(`  thumb: ${row.thumbnail_url}`);
    console.log(`  aff:   ${row.affiliate_url}`);
    console.log('');
  }

  // affiliate_urlから直接正しいサムネイルURLを生成
  // affiliate_url: http://duga.jp/ppv/gogos-0733/
  // 正解: https://pic.duga.jp/unsecure/gogos/0733/noauth/jacket_240.jpg
  console.log('=== 修正実行 ===');
  const updateResult = await pool.query(`
    WITH extracted AS (
      SELECT
        pc.id,
        -- affiliate_urlから商品コードを抽出 (例: gogos-0733)
        regexp_replace(pc.affiliate_url, '.*/ppv/([^/]+)/?.*', '\\1') as product_code
      FROM product_cache pc
      WHERE pc.asp_name = 'DUGA'
        AND pc.affiliate_url LIKE '%duga.jp/ppv/%'
    )
    UPDATE product_cache pc
    SET thumbnail_url =
      'https://pic.duga.jp/unsecure/' ||
      -- gogos-0733 → gogos/0733
      replace(e.product_code, '-', '/') ||
      '/noauth/jacket_240.jpg'
    FROM extracted e
    WHERE pc.id = e.id
    RETURNING pc.id
  `);

  console.log(`Updated ${updateResult.rowCount} rows`);

  // 修正後確認
  const sampleAfter = await pool.query(`
    SELECT thumbnail_url, affiliate_url
    FROM product_cache
    WHERE asp_name = 'DUGA' AND thumbnail_url IS NOT NULL
    LIMIT 10
  `);
  console.log('\n=== 修正後サンプル ===');
  for (const row of sampleAfter.rows) {
    console.log(`  ${row.thumbnail_url}`);
  }

  await pool.end();
}

main().catch(console.error);
