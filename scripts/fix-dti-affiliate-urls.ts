/**
 * DTIアフィリエイトURLを一括修正するスクリプト
 *
 * 生のサイトURL (https://www.caribbeancompr.com/moviepages/xxx/index.html) を
 * clear-tv.comアフィリエイト形式に変換
 */

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres';
}

import { getDb } from '../lib/db/index';
import { sql } from 'drizzle-orm';

// DTI アフィリエイトコード
const DTI_AFFILIATE_CODES: Record<string, string> = {
  heyzo: '9450999-450-239360',
  caribbeancompr: '9290999-290-239360',
  caribbeancom: '9290999-290-239360',
  '1pondo': '9200999-200-239360',
};

function detectSiteFromUrl(url: string): keyof typeof DTI_AFFILIATE_CODES | null {
  if (url.includes('heyzo.com')) return 'heyzo';
  if (url.includes('caribbeancompr.com')) return 'caribbeancompr';
  if (url.includes('caribbeancom.com')) return 'caribbeancom';
  if (url.includes('1pondo.tv')) return '1pondo';
  return null;
}

function extractMovieId(url: string): string | null {
  // /moviepages/xxx/ パターン
  const moviepagesMatch = url.match(/\/moviepages\/([^\/]+)/);
  if (moviepagesMatch) return moviepagesMatch[1];

  // /movies/xxx/ パターン (一本道)
  const moviesMatch = url.match(/\/movies\/([^\/]+)/);
  if (moviesMatch) return moviesMatch[1];

  return null;
}

function convertToAffiliateUrl(originalUrl: string): string | null {
  const site = detectSiteFromUrl(originalUrl);
  const movieId = extractMovieId(originalUrl);

  if (!site || !movieId) return null;

  const affiliateCode = DTI_AFFILIATE_CODES[site];
  return `https://clear-tv.com/Direct/${affiliateCode}/moviepages/${movieId}/index.html`;
}

async function fixDtiAffiliateUrls() {
  const db = getDb();

  console.log('=== Fixing DTI Affiliate URLs ===\n');

  // 1. 現在のURL状況確認
  const beforeStats = await db.execute(sql`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE affiliate_url LIKE 'https://clear-tv.com/%') as correct,
      COUNT(*) FILTER (WHERE affiliate_url LIKE 'https://www.caribbeancompr.com/%') as caribbeancompr,
      COUNT(*) FILTER (WHERE affiliate_url LIKE 'https://www.caribbeancom.com/%') as caribbeancom,
      COUNT(*) FILTER (WHERE affiliate_url LIKE 'https://www.heyzo.com/%') as heyzo,
      COUNT(*) FILTER (WHERE affiliate_url LIKE 'https://www.1pondo.tv/%') as onepondo
    FROM product_sources
    WHERE asp_name = 'DTI'
  `);
  console.log('Before stats:');
  console.log(`  Total: ${beforeStats.rows[0].total}`);
  console.log(`  Already correct (clear-tv.com): ${beforeStats.rows[0].correct}`);
  console.log(`  caribbeancompr.com: ${beforeStats.rows[0].caribbeancompr}`);
  console.log(`  caribbeancom.com: ${beforeStats.rows[0].caribbeancom}`);
  console.log(`  heyzo.com: ${beforeStats.rows[0].heyzo}`);
  console.log(`  1pondo.tv: ${beforeStats.rows[0].onepondo}`);

  // 2. 修正が必要なURLを取得
  const urlsToFix = await db.execute(sql`
    SELECT id, affiliate_url
    FROM product_sources
    WHERE asp_name = 'DTI'
    AND affiliate_url NOT LIKE 'https://clear-tv.com/%'
  `);

  console.log(`\nURLs to fix: ${urlsToFix.rows.length}`);

  // 3. 各URLを修正
  let fixed = 0;
  let failed = 0;

  for (const row of urlsToFix.rows) {
    const newUrl = convertToAffiliateUrl(row.affiliate_url as string);

    if (newUrl) {
      await db.execute(sql`
        UPDATE product_sources
        SET affiliate_url = ${newUrl}
        WHERE id = ${row.id}
      `);
      fixed++;
    } else {
      console.log(`  Failed to convert: ${row.affiliate_url}`);
      failed++;
    }
  }

  console.log(`\nFixed: ${fixed}, Failed: ${failed}`);

  // 4. 確認
  const afterStats = await db.execute(sql`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE affiliate_url LIKE 'https://clear-tv.com/%') as correct
    FROM product_sources
    WHERE asp_name = 'DTI'
  `);
  console.log(`\nAfter: ${afterStats.rows[0].correct}/${afterStats.rows[0].total} correct`);

  // サンプル表示
  console.log('\n=== Sample URLs after fix ===');
  const samples = await db.execute(sql`
    SELECT affiliate_url FROM product_sources
    WHERE asp_name = 'DTI'
    LIMIT 5
  `);
  for (const row of samples.rows) {
    console.log(`  ${row.affiliate_url}`);
  }
}

fixDtiAffiliateUrls()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });
