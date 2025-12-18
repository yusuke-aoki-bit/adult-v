/**
 * DUGA画像サイズ修正スクリプト
 *
 * DBに保存された小さいサイズの画像URL（240x180等）を大きいサイズ（640x480）に更新
 *
 * Usage:
 *   npx tsx packages/crawlers/src/enrichment/backfill-duga-image-sizes.ts [--limit N] [--dry-run]
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
  return url
    // サイズ指定パターン
    .replace(/\/240x180\.jpg/g, '/640x480.jpg')
    .replace(/\/noauth\/240x180\.jpg/g, '/noauth/640x480.jpg')
    .replace(/\/480x360\.jpg/g, '/640x480.jpg')
    // scap → sample は試さない（404になることが多い）
    // -t, _t, /t/ パターン
    .replace(/-t\.jpg/g, '-l.jpg')
    .replace(/_t\.jpg/g, '_l.jpg')
    .replace(/\/t\//g, '/l/')
    // -s, _s パターン
    .replace(/-s\.jpg/g, '-l.jpg')
    .replace(/_s\.jpg/g, '_l.jpg');
}

/**
 * URLが小さいサイズかどうかを判定
 */
function isSmallSize(url: string): boolean {
  return (
    url.includes('/240x180.') ||
    url.includes('/480x360.') ||
    url.includes('-t.jpg') ||
    url.includes('_t.jpg') ||
    url.includes('/t/') ||
    url.includes('-s.jpg') ||
    url.includes('_s.jpg')
  );
}

async function main() {
  const args = process.argv.slice(2);
  const limit = parseInt(args.find((arg, i) => args[i - 1] === '--limit') || '5000');
  const dryRun = args.includes('--dry-run');

  console.log('=== DUGA画像サイズ修正 ===');
  console.log(`Limit: ${limit}`);
  console.log(`Dry run: ${dryRun}`);
  console.log('');

  const db = getDb();
  let processed = 0;
  let updated = 0;
  let skipped = 0;

  // 1. product_imagesテーブルの画像を修正
  console.log('--- product_images テーブル ---');
  // 注: /t/ は /tender/, /takara/ などにもマッチしてしまうので除外
  // 具体的なサイズ指定パターンのみを対象とする
  const imagesResult = await db.execute(sql`
    SELECT id, product_id, image_url
    FROM product_images
    WHERE asp_name = 'DUGA'
    AND (
      image_url LIKE '%/240x180.jpg%'
      OR image_url LIKE '%/480x360.jpg%'
      OR image_url LIKE '%-t.jpg'
      OR image_url LIKE '%_t.jpg'
      OR image_url LIKE '%-s.jpg'
      OR image_url LIKE '%_s.jpg'
    )
    LIMIT ${limit}
  `);

  const images = imagesResult.rows as ImageRow[];
  console.log(`対象画像: ${images.length}件`);

  // デバッグ: 最初の10件のURLパターンを表示
  if (images.length > 0) {
    console.log('\n--- サンプルURL ---');
    for (const img of images.slice(0, 10)) {
      const newUrl = convertToLargeSize(img.image_url);
      const changed = newUrl !== img.image_url;
      console.log(`[${changed ? '変換あり' : '変換なし'}] ${img.image_url}`);
      if (changed) {
        console.log(`  -> ${newUrl}`);
      }
    }
    console.log('--- サンプルURL終わり ---\n');
  }

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
    WHERE ps.asp_name = 'DUGA'
    AND p.default_thumbnail_url IS NOT NULL
    AND (
      p.default_thumbnail_url LIKE '%/240x180.jpg%'
      OR p.default_thumbnail_url LIKE '%/480x360.jpg%'
      OR p.default_thumbnail_url LIKE '%-t.jpg'
      OR p.default_thumbnail_url LIKE '%_t.jpg'
      OR p.default_thumbnail_url LIKE '%-s.jpg'
      OR p.default_thumbnail_url LIKE '%_s.jpg'
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
      WHERE asp_name = 'DUGA'
      AND (
        image_url LIKE '%/240x180.jpg%'
        OR image_url LIKE '%/480x360.jpg%'
        OR image_url LIKE '%-t.jpg'
        OR image_url LIKE '%_t.jpg'
        OR image_url LIKE '%-s.jpg'
        OR image_url LIKE '%_s.jpg'
      )
    `);
    console.log(`残りの小サイズ画像: ${(remainingImages.rows[0] as any)?.count || 0}件`);

    const remainingProducts = await db.execute(sql`
      SELECT COUNT(*)::int as count
      FROM products p
      JOIN product_sources ps ON p.id = ps.product_id
      WHERE ps.asp_name = 'DUGA'
      AND (
        p.default_thumbnail_url LIKE '%/240x180.jpg%'
        OR p.default_thumbnail_url LIKE '%/480x360.jpg%'
        OR p.default_thumbnail_url LIKE '%-t.jpg'
        OR p.default_thumbnail_url LIKE '%_t.jpg'
        OR p.default_thumbnail_url LIKE '%-s.jpg'
        OR p.default_thumbnail_url LIKE '%_s.jpg'
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
