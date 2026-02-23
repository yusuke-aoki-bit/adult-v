/**
 * SOKMIL画像サイズ修正スクリプト
 *
 * DBに保存された小さいサイズの画像URLを大きいサイズに更新
 *
 * Usage:
 *   npx tsx packages/crawlers/src/enrichment/backfill-sokmil-image-sizes.ts [--limit N] [--dry-run]
 */

import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

const BATCH_SIZE = 100;

interface ImageRow {
  id: number;
  product_id: number;
  image_url: string;
}

/**
 * 小さいサイズのURLを大きいサイズに変換
 */
function convertToLargeSize(url: string): string {
  return (
    url
      // サイズ指定パターン
      .replace(/_100x142_/g, '_250x356_')
      .replace(/_200x284_/g, '_250x356_')
      // capture -> content
      .replace(/\/capture\//g, '/content/')
      // /s/ -> /l/
      .replace(/\/s\//g, '/l/')
      // /small/ -> /large/
      .replace(/\/small\//g, '/large/')
      // /thumb/ -> /large/
      .replace(/\/thumb\//g, '/large/')
      // _s. -> _l.
      .replace(/_s\./g, '_l.')
      // -s. -> -l.
      .replace(/-s\./g, '-l.')
  );
}

/**
 * URLが小さいサイズかどうかを判定
 */
function isSmallSize(url: string): boolean {
  return (
    url.includes('_100x142_') ||
    url.includes('_200x284_') ||
    url.includes('/capture/') ||
    url.includes('/s/') ||
    url.includes('/small/') ||
    url.includes('/thumb/') ||
    url.includes('_s.') ||
    url.includes('-s.')
  );
}

async function main() {
  const args = process.argv.slice(2);
  const limit = parseInt(args.find((arg, i) => args[i - 1] === '--limit') || '50000');
  const dryRun = args.includes('--dry-run');

  console.log('=== SOKMIL画像サイズ修正 ===');
  console.log(`Limit: ${limit}`);
  console.log(`Dry run: ${dryRun}`);
  console.log('');

  const db = getDb();
  let processed = 0;
  let updated = 0;
  let skipped = 0;

  // 1. product_imagesテーブルの画像を修正
  console.log('--- product_images テーブル ---');
  const imagesResult = await db.execute(sql`
    SELECT id, product_id, image_url
    FROM product_images
    WHERE asp_name = 'SOKMIL'
    AND (
      image_url LIKE '%_100x142_%'
      OR image_url LIKE '%_200x284_%'
      OR image_url LIKE '%/capture/%'
      OR image_url LIKE '%/s/%'
      OR image_url LIKE '%/small/%'
      OR image_url LIKE '%/thumb/%'
      OR image_url LIKE '%_s.%'
      OR image_url LIKE '%-s.%'
    )
    LIMIT ${limit}
  `);

  const images = imagesResult.rows as unknown as ImageRow[];
  console.log(`対象画像: ${images.length}件`);

  for (const img of images) {
    processed++;
    const newUrl = convertToLargeSize(img.image_url);

    if (newUrl === img.image_url) {
      skipped++;
      continue;
    }

    if (dryRun) {
      if (processed <= 5) {
        console.log(`[DRY] ${img.image_url}`);
        console.log(`  -> ${newUrl}`);
      }
      updated++;
      continue;
    }

    await db.execute(sql`
      UPDATE product_images
      SET image_url = ${newUrl}
      WHERE id = ${img.id}
    `);
    updated++;

    if (processed % BATCH_SIZE === 0) {
      console.log(`進捗: ${processed}/${images.length} (更新: ${updated})`);
    }
  }

  console.log(`product_images: ${updated}/${processed}件更新\n`);

  // 2. productsテーブルのdefault_thumbnail_urlを修正
  console.log('--- products テーブル (default_thumbnail_url) ---');
  processed = 0;
  updated = 0;
  skipped = 0;

  const productsResult = await db.execute(sql`
    SELECT p.id, p.default_thumbnail_url as image_url
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    WHERE ps.asp_name = 'SOKMIL'
    AND p.default_thumbnail_url IS NOT NULL
    AND p.default_thumbnail_url LIKE '%sokmil%'
    AND (
      p.default_thumbnail_url LIKE '%_100x142_%'
      OR p.default_thumbnail_url LIKE '%_200x284_%'
      OR p.default_thumbnail_url LIKE '%/capture/%'
      OR p.default_thumbnail_url LIKE '%/s/%'
      OR p.default_thumbnail_url LIKE '%/small/%'
      OR p.default_thumbnail_url LIKE '%/thumb/%'
      OR p.default_thumbnail_url LIKE '%_s.%'
      OR p.default_thumbnail_url LIKE '%-s.%'
    )
    LIMIT ${limit}
  `);

  const products = productsResult.rows as { id: number; image_url: string }[];
  console.log(`対象商品: ${products.length}件`);

  for (const prod of products) {
    processed++;
    const newUrl = convertToLargeSize(prod.image_url);

    if (newUrl === prod.image_url) {
      skipped++;
      continue;
    }

    if (dryRun) {
      if (processed <= 5) {
        console.log(`[DRY] ${prod.image_url}`);
        console.log(`  -> ${newUrl}`);
      }
      updated++;
      continue;
    }

    await db.execute(sql`
      UPDATE products
      SET default_thumbnail_url = ${newUrl}
      WHERE id = ${prod.id}
    `);
    updated++;

    if (processed % BATCH_SIZE === 0) {
      console.log(`進捗: ${processed}/${products.length} (更新: ${updated})`);
    }
  }

  console.log(`products: ${updated}/${processed}件更新\n`);

  // 3. 統計表示
  console.log('=== 完了 ===');

  // 残りの小サイズ画像数をカウント
  if (!dryRun) {
    const remainingImages = await db.execute(sql`
      SELECT COUNT(*)::int as count
      FROM product_images
      WHERE asp_name = 'SOKMIL'
      AND (
        image_url LIKE '%_100x142_%'
        OR image_url LIKE '%_200x284_%'
        OR image_url LIKE '%/capture/%'
        OR image_url LIKE '%/small/%'
      )
    `);
    console.log(`残りの小サイズ画像: ${(remainingImages.rows[0] as any)?.count || 0}件`);

    const remainingProducts = await db.execute(sql`
      SELECT COUNT(*)::int as count
      FROM products p
      JOIN product_sources ps ON p.id = ps.product_id
      WHERE ps.asp_name = 'SOKMIL'
      AND p.default_thumbnail_url LIKE '%sokmil%'
      AND (
        p.default_thumbnail_url LIKE '%_100x142_%'
        OR p.default_thumbnail_url LIKE '%_200x284_%'
        OR p.default_thumbnail_url LIKE '%/capture/%'
        OR p.default_thumbnail_url LIKE '%/small/%'
      )
    `);
    console.log(`残りの小サイズサムネイル: ${(remainingProducts.rows[0] as any)?.count || 0}件`);
  }

  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
