/**
 * DUGA壊れたURLをチェックして修正するスクリプト
 */

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres';
}

import { getDb } from '../lib/db/index';
import { sql } from 'drizzle-orm';

const DUGA_AFFILIATE_ID = '48611-01';

async function checkAndFix() {
  const db = getDb();

  console.log('=== DUGA URL Status Check ===\n');

  // 1. 全体の状況確認
  const stats = await db.execute(sql`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE affiliate_url LIKE 'https://click.duga.jp/%/%/%') as correct,
      COUNT(*) FILTER (WHERE affiliate_url = 'https://click.duga.jp/48611-01') as broken_no_path,
      COUNT(*) FILTER (WHERE affiliate_url NOT LIKE 'https://click.duga.jp/%/%/%' AND affiliate_url != 'https://click.duga.jp/48611-01') as other_broken
    FROM product_cache
    WHERE asp_name = 'DUGA'
  `);
  console.log('product_cache stats:');
  console.log(`  Total: ${stats.rows[0].total}`);
  console.log(`  Correct (click.duga.jp/x/x/x): ${stats.rows[0].correct}`);
  console.log(`  Broken (no path): ${stats.rows[0].broken_no_path}`);
  console.log(`  Other broken: ${stats.rows[0].other_broken}`);

  // product_sourcesも確認
  const psStats = await db.execute(sql`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE affiliate_url LIKE 'https://click.duga.jp/%/%/%') as correct,
      COUNT(*) FILTER (WHERE affiliate_url = 'https://click.duga.jp/48611-01') as broken_no_path,
      COUNT(*) FILTER (WHERE affiliate_url NOT LIKE 'https://click.duga.jp/%/%/%' AND affiliate_url != 'https://click.duga.jp/48611-01') as other_broken
    FROM product_sources
    WHERE asp_name = 'DUGA'
  `);
  console.log('\nproduct_sources stats:');
  console.log(`  Total: ${psStats.rows[0].total}`);
  console.log(`  Correct: ${psStats.rows[0].correct}`);
  console.log(`  Broken (no path): ${psStats.rows[0].broken_no_path}`);
  console.log(`  Other broken: ${psStats.rows[0].other_broken}`);

  // 2. サンプル確認
  const samples = await db.execute(sql`
    SELECT affiliate_url FROM product_cache
    WHERE asp_name = 'DUGA'
    LIMIT 10
  `);
  console.log('\nSample URLs from product_cache:');
  for (const row of samples.rows) {
    console.log(`  ${row.affiliate_url}`);
  }

  // 3. 壊れたURLのサンプル
  const brokenSamples = await db.execute(sql`
    SELECT id, affiliate_url FROM product_cache
    WHERE asp_name = 'DUGA'
    AND affiliate_url NOT LIKE 'https://click.duga.jp/%/%/%'
    LIMIT 10
  `);
  if (brokenSamples.rows.length > 0) {
    console.log('\nBroken URL samples:');
    for (const row of brokenSamples.rows) {
      console.log(`  ID: ${row.id}, URL: ${row.affiliate_url}`);
    }
  }

  // 4. 修正実行
  const brokenCount = Number(stats.rows[0].broken_no_path) + Number(stats.rows[0].other_broken);
  if (brokenCount > 0) {
    console.log('\n=== Fixing broken URLs in product_cache ===');

    // product_cacheの壊れたURLをproductsのnormalized_product_idから復元
    await db.execute(sql`
      UPDATE product_cache pc
      SET affiliate_url = 'https://click.duga.jp/ppv/' || p.normalized_product_id || '/' || ${DUGA_AFFILIATE_ID}
      FROM products p
      WHERE pc.product_id = p.id
      AND pc.asp_name = 'DUGA'
      AND pc.affiliate_url NOT LIKE 'https://click.duga.jp/%/%/%'
      AND p.normalized_product_id IS NOT NULL
      AND p.normalized_product_id != ''
    `);
    console.log('Fixed product_cache rows using products.normalized_product_id');

    // http://duga.jp形式のURLも変換（REGEX使用）
    await db.execute(sql`
      UPDATE product_cache
      SET affiliate_url =
        'https://click.duga.jp' ||
        REGEXP_REPLACE(
          REGEXP_REPLACE(affiliate_url, '^https?://[^/]+', ''),
          '/?$', ''
        ) || '/' || ${DUGA_AFFILIATE_ID}
      WHERE asp_name = 'DUGA'
      AND affiliate_url LIKE 'http://duga.jp/%'
    `);
    console.log('Fixed http://duga.jp URLs in product_cache');
  }

  // product_sourcesも修正
  const psBrokenCount = Number(psStats.rows[0].broken_no_path) + Number(psStats.rows[0].other_broken);
  if (psBrokenCount > 0) {
    console.log('\n=== Fixing broken URLs in product_sources ===');

    // product_sourcesはproduct_cacheから復元
    await db.execute(sql`
      UPDATE product_sources ps
      SET affiliate_url = pc.affiliate_url
      FROM product_cache pc
      WHERE ps.product_id = pc.product_id
      AND ps.asp_name = 'DUGA'
      AND ps.affiliate_url NOT LIKE 'https://click.duga.jp/%/%/%'
      AND pc.affiliate_url LIKE 'https://click.duga.jp/%/%/%'
    `);
    console.log('Fixed product_sources rows using product_cache affiliate_url');
  }

  // 修正後の確認
  const afterStats = await db.execute(sql`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE affiliate_url LIKE 'https://click.duga.jp/%/%/%') as correct
    FROM product_cache
    WHERE asp_name = 'DUGA'
  `);
  console.log(`\nAfter fix (product_cache): ${afterStats.rows[0].correct}/${afterStats.rows[0].total} correct`);

  const afterPsStats = await db.execute(sql`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE affiliate_url LIKE 'https://click.duga.jp/%/%/%') as correct
    FROM product_sources
    WHERE asp_name = 'DUGA'
  `);
  console.log(`After fix (product_sources): ${afterPsStats.rows[0].correct}/${afterPsStats.rows[0].total} correct`);
}

checkAndFix()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });
