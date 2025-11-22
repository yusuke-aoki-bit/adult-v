/**
 * DTIサイト用サムネイル生成
 * DTIサイトの画像URLは、各サイトごとに異なるパターンがある
 * - heyzo.com: //www.heyzo.com/listpages/mediaplayer_xxx/images/main.jpg
 * - caribbeancom: //www.caribbeancom.com/moviepages/xxx/images/main.jpg
 * - 1pondo.tv: //www.1pondo.tv/assets/sample/xxx/main.jpg
 */
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres';

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  console.log('=== DTIサムネイル状況確認 ===\n');

  // サムネイルなしのDTIデータを確認
  const noThumb = await pool.query(`
    SELECT affiliate_url, product_id
    FROM product_cache
    WHERE asp_name = 'DTI' AND thumbnail_url IS NULL
    LIMIT 20
  `);

  console.log('サムネイルなしDTI:');
  for (const row of noThumb.rows) {
    console.log(`  ${row.affiliate_url}`);
  }

  // サムネイルありのDTIデータを確認
  const withThumb = await pool.query(`
    SELECT affiliate_url, thumbnail_url
    FROM product_cache
    WHERE asp_name = 'DTI' AND thumbnail_url IS NOT NULL
    LIMIT 10
  `);

  console.log('\nサムネイルありDTI:');
  for (const row of withThumb.rows) {
    console.log(`  aff: ${row.affiliate_url}`);
    console.log(`  thumb: ${row.thumbnail_url}`);
    console.log('');
  }

  // DTIのaffiliate_urlパターンを分析
  const patterns = await pool.query(`
    SELECT
      CASE
        WHEN affiliate_url LIKE '%heyzo%' THEN 'heyzo'
        WHEN affiliate_url LIKE '%caribbeancom%' THEN 'caribbeancom'
        WHEN affiliate_url LIKE '%caribbeancompr%' THEN 'caribbeancompr'
        WHEN affiliate_url LIKE '%1pondo%' THEN '1pondo'
        WHEN affiliate_url LIKE '%pacopacomama%' THEN 'pacopacomama'
        WHEN affiliate_url LIKE '%10musume%' THEN '10musume'
        ELSE 'other'
      END as site,
      COUNT(*) as count,
      COUNT(thumbnail_url) as with_thumb
    FROM product_cache
    WHERE asp_name = 'DTI'
    GROUP BY 1
    ORDER BY count DESC
  `);

  console.log('\nDTIサイト別内訳:');
  for (const row of patterns.rows) {
    console.log(`  ${row.site}: ${row.count}件 (サムネあり: ${row.with_thumb}件)`);
  }

  await pool.end();
}

main().catch(console.error);
