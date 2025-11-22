/**
 * DUGAのサムネイルURLを商品IDから生成してproduct_cacheに登録
 * DUGAの画像URLパターン: https://pic.duga.jp/ppv/{商品ID}/noauth/jacket.jpg
 */
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres';

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  console.log('=== DUGA サムネイルURL生成 ===\n');

  // product_sources からオリジナルIDを取得
  console.log('Checking product_sources for DUGA original IDs...');
  const sampleSources = await pool.query(`
    SELECT ps.product_id, ps.original_product_id, ps.affiliate_url
    FROM product_sources ps
    WHERE ps.asp_name = 'DUGA'
    LIMIT 10
  `);
  console.log('Sample DUGA sources:', sampleSources.rows.length);
  for (const row of sampleSources.rows) {
    console.log(`  ProductID ${row.product_id}: original=${row.original_product_id}, url=${row.affiliate_url?.substring(0, 60)}...`);
  }

  // affiliate_urlから商品IDを抽出してサムネイルURLを生成
  console.log('\n=== サムネイルURL生成・更新 ===');

  // DUGAのURL形式: http://duga.jp/ppv/{商品ID}/
  // サムネイル形式: https://pic.duga.jp/ppv/{商品ID}/noauth/jacket.jpg
  const updateResult = await pool.query(`
    WITH duga_ids AS (
      SELECT
        pc.id as cache_id,
        pc.product_id,
        -- affiliate_urlから商品IDを抽出
        -- 例: http://duga.jp/ppv/100hame-0002/ → 100hame-0002
        regexp_replace(pc.affiliate_url, '.*/ppv/([^/]+)/?.*', '\\1') as product_code
      FROM product_cache pc
      WHERE pc.asp_name = 'DUGA'
        AND pc.thumbnail_url IS NULL
        AND pc.affiliate_url LIKE '%duga.jp/ppv/%'
    )
    UPDATE product_cache pc
    SET thumbnail_url = 'https://pic.duga.jp/ppv/' || d.product_code || '/noauth/jacket.jpg'
    FROM duga_ids d
    WHERE pc.id = d.cache_id
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
  console.log('\n=== DUGA サムネイル状況 (更新後) ===');
  console.log(finalStats.rows[0]);

  // サンプル確認
  console.log('\n=== 更新後サンプル ===');
  const samples = await pool.query(`
    SELECT product_id, thumbnail_url
    FROM product_cache
    WHERE asp_name = 'DUGA' AND thumbnail_url IS NOT NULL
    LIMIT 5
  `);
  for (const row of samples.rows) {
    console.log(`  ProductID ${row.product_id}: ${row.thumbnail_url}`);
  }

  await pool.end();
}

main().catch(console.error);
