/**
 * DUGAアフィリエイトURLを一括修正するスクリプト
 * 形式: https://click.duga.jp/ppv/{product-id}/48611-01
 */

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres';
}

import { getDb } from '../lib/db/index';
import { sql } from 'drizzle-orm';

const DUGA_AFFILIATE_ID = '48611-01';

async function fixDugaUrls() {
  console.log('Fixing DUGA affiliate URLs to click.duga.jp format...\n');

  const db = getDb();

  // 現在のURLサンプルを確認
  const samples = await db.execute(sql`
    SELECT id, affiliate_url FROM product_cache
    WHERE asp_name = 'DUGA'
    AND affiliate_url LIKE '%duga.jp%'
    AND affiliate_url NOT LIKE 'https://click.duga.jp/%'
    LIMIT 5
  `);
  console.log('Current URL samples to fix:');
  for (const row of samples.rows) {
    console.log(`  ${row.affiliate_url}`);
  }

  // URLからパスを抽出して変換
  // http://duga.jp/ppv/dopyuch-0014/ → https://click.duga.jp/ppv/dopyuch-0014/48611-01
  // http://duga.jp/month/hot-1707/?affid=48611-01 → https://click.duga.jp/month/hot-1707/48611-01

  console.log('\nUpdating URLs...');

  // まず、壊れたURL (https://click.duga.jp/48611-01) を除外
  const brokenCount = await db.execute(sql`
    SELECT COUNT(*) as count FROM product_cache
    WHERE asp_name = 'DUGA'
    AND affiliate_url = 'https://click.duga.jp/48611-01'
  `);
  console.log(`Broken URLs (without path): ${brokenCount.rows[0].count}`);

  // 正常なduga.jp URLを変換
  // パターン: http(s)://duga.jp/{type}/{product-id}/ → https://click.duga.jp/{type}/{product-id}/48611-01
  await db.execute(sql`
    UPDATE product_cache
    SET affiliate_url =
      'https://click.duga.jp' ||
      REGEXP_REPLACE(
        REGEXP_REPLACE(affiliate_url, '^https?://[^/]+', ''),
        '/?\?.*$', ''
      ) ||
      '/' || ${DUGA_AFFILIATE_ID}
    WHERE asp_name = 'DUGA'
    AND affiliate_url LIKE '%duga.jp%'
    AND affiliate_url NOT LIKE 'https://click.duga.jp/%'
    AND affiliate_url ~ '^https?://[^/]+/[^/]+/[^/]+/?'
  `);

  // 壊れたURLはproducts.normalized_product_idから復元
  // normalized_product_idは "100hame-0002" のような形式
  console.log('\nFixing broken URLs using normalized_product_id...');
  await db.execute(sql`
    UPDATE product_cache pc
    SET affiliate_url = 'https://click.duga.jp/ppv/' || p.normalized_product_id || '/' || ${DUGA_AFFILIATE_ID}
    FROM products p
    WHERE pc.product_id = p.id
    AND pc.asp_name = 'DUGA'
    AND (
      pc.affiliate_url = 'https://click.duga.jp/48611-01'
      OR pc.affiliate_url NOT LIKE 'https://click.duga.jp/%/%/%'
    )
  `);

  console.log('Update completed');

  // 確認
  const afterSamples = await db.execute(sql`
    SELECT affiliate_url FROM product_cache
    WHERE asp_name = 'DUGA'
    LIMIT 10
  `);
  console.log('\nUpdated URL samples:');
  for (const row of afterSamples.rows) {
    console.log(`  ${row.affiliate_url}`);
  }

  // 統計
  const stats = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE affiliate_url LIKE 'https://click.duga.jp/%/%/%') as correct_format,
      COUNT(*) FILTER (WHERE affiliate_url NOT LIKE 'https://click.duga.jp/%') as wrong_format
    FROM product_cache
    WHERE asp_name = 'DUGA'
  `);
  console.log(`\nStats (product_cache): ${stats.rows[0].correct_format} correct, ${stats.rows[0].wrong_format} wrong format`);

  // ===== product_sources も修正 =====
  console.log('\n===== Fixing product_sources table =====');

  const psSamples = await db.execute(sql`
    SELECT id, affiliate_url FROM product_sources
    WHERE asp_name = 'DUGA'
    AND affiliate_url NOT LIKE 'https://click.duga.jp/%'
    LIMIT 5
  `);
  console.log('product_sources URLs to fix:');
  for (const row of psSamples.rows) {
    console.log(`  ${row.affiliate_url}`);
  }

  // product_sources の http://duga.jp URLs を修正
  await db.execute(sql`
    UPDATE product_sources
    SET affiliate_url =
      'https://click.duga.jp' ||
      REGEXP_REPLACE(
        REGEXP_REPLACE(affiliate_url, '^https?://[^/]+', ''),
        '/?\?.*$', ''
      ) ||
      '/' || ${DUGA_AFFILIATE_ID}
    WHERE asp_name = 'DUGA'
    AND affiliate_url LIKE '%duga.jp%'
    AND affiliate_url NOT LIKE 'https://click.duga.jp/%'
    AND affiliate_url ~ '^https?://[^/]+/[^/]+/[^/]+/?'
  `);

  // 統計
  const psStats = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE affiliate_url LIKE 'https://click.duga.jp/%') as correct_format,
      COUNT(*) FILTER (WHERE affiliate_url NOT LIKE 'https://click.duga.jp/%') as wrong_format
    FROM product_sources
    WHERE asp_name = 'DUGA'
  `);
  console.log(`\nStats (product_sources): ${psStats.rows[0].correct_format} correct, ${psStats.rows[0].wrong_format} wrong format`);
}

fixDugaUrls()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
