/**
 * DTIサイト用サムネイル生成・修正
 *
 * caribbeancompr:
 *   affiliate_url: https://www.caribbeancompr.com/moviepages/113019_002/index.html
 *   thumbnail_url: https://www.caribbeancompr.com/moviepages/113019_002/images/l_l.jpg
 *
 * 1pondo:
 *   affiliate_url: https://www.1pondo.tv/movies/041918_673/
 *   thumbnail_url: https://www.1pondo.tv/assets/sample/041918_673/str.jpg
 */
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres';

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  console.log('=== DTIサムネイル修正 ===\n');

  // caribbeancompr用
  console.log('--- caribbeancompr修正 ---');
  const caribbeanResult = await pool.query(`
    UPDATE product_cache
    SET thumbnail_url =
      regexp_replace(affiliate_url, '/index\\.html$', '') || '/images/l_l.jpg'
    WHERE asp_name = 'DTI'
      AND affiliate_url LIKE '%caribbeancompr.com/moviepages/%'
      AND thumbnail_url IS NULL
    RETURNING id
  `);
  console.log(`caribbeancompr: ${caribbeanResult.rowCount}件更新`);

  // 1pondo用 (URLパターン: /movies/041918_673/ → /assets/sample/041918_673/str.jpg)
  console.log('--- 1pondo修正 ---');
  const pondoResult = await pool.query(`
    UPDATE product_cache
    SET thumbnail_url =
      'https://www.1pondo.tv/assets/sample/' ||
      regexp_replace(affiliate_url, '.*/movies/([^/]+)/?.*', '\\1') ||
      '/str.jpg'
    WHERE asp_name = 'DTI'
      AND affiliate_url LIKE '%1pondo.tv/movies/%'
      AND thumbnail_url IS NULL
    RETURNING id
  `);
  console.log(`1pondo: ${pondoResult.rowCount}件更新`);

  // 結果確認
  const stats = await pool.query(`
    SELECT
      CASE
        WHEN affiliate_url LIKE '%heyzo%' THEN 'heyzo'
        WHEN affiliate_url LIKE '%caribbeancompr%' THEN 'caribbeancompr'
        WHEN affiliate_url LIKE '%1pondo%' THEN '1pondo'
        ELSE 'other'
      END as site,
      COUNT(*) as total,
      COUNT(thumbnail_url) as with_thumb
    FROM product_cache
    WHERE asp_name = 'DTI'
    GROUP BY 1
    ORDER BY total DESC
  `);

  console.log('\n=== 修正後 DTIサイト別内訳 ===');
  for (const row of stats.rows) {
    console.log(`  ${row.site}: ${row.total}件 (サムネあり: ${row.with_thumb}件)`);
  }

  // サンプル表示
  const samples = await pool.query(`
    SELECT affiliate_url, thumbnail_url
    FROM product_cache
    WHERE asp_name = 'DTI'
      AND (affiliate_url LIKE '%caribbeancompr%' OR affiliate_url LIKE '%1pondo%')
      AND thumbnail_url IS NOT NULL
    LIMIT 5
  `);
  console.log('\n=== 修正後サンプル ===');
  for (const row of samples.rows) {
    console.log(`  aff: ${row.affiliate_url}`);
    console.log(`  thumb: ${row.thumbnail_url}`);
    console.log('');
  }

  // next.config.tsへの追加が必要なホストを確認
  console.log('=== next.config.ts確認 ===');
  console.log('以下のドメインがnext.config.tsに追加が必要:');
  console.log('  - www.caribbeancompr.com');
  console.log('  - www.1pondo.tv');

  await pool.end();
}

main().catch(console.error);
