/**
 * MGSサンプル画像バックフィル
 * サムネイルURL（_120x90など）をフルサイズURLに修正
 * product_imagesテーブルのsample画像を対象
 *
 * 使用方法:
 *   npx tsx scripts/backfill/backfill-mgs-sample-images.ts
 *   npx tsx scripts/backfill/backfill-mgs-sample-images.ts --dry-run
 *   npx tsx scripts/backfill/backfill-mgs-sample-images.ts --limit=500
 */

import { db } from '../../lib/db';
import { productSources, productImages } from '../../lib/db/schema';
import { eq, and, like, inArray, sql } from 'drizzle-orm';
import * as cheerio from 'cheerio';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const DELAY_MS = 2000;

/**
 * MGSページから拡大サンプル画像URLを取得
 */
async function fetchFullSizeImages(productUrl: string): Promise<string[]> {
  try {
    const response = await fetch(productUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
        'Cookie': 'adc=1',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const sampleImages: string[] = [];

    // Helper function to check if URL should be excluded
    const shouldExcludeImage = (url: string): boolean => {
      if (url.includes('sample_button') || url.includes('sample-button')) return true;
      if (url.includes('samplemovie') || url.includes('sample_movie')) return true;
      if (url.includes('btn_sample')) return true;
      return false;
    };

    // パターン1: sample-photo 内のaタグのhrefから拡大画像URLを取得
    $('.sample-photo a').each((_, elem) => {
      const href = $(elem).attr('href');
      if (href && !shouldExcludeImage(href)) {
        const fullUrl = href.startsWith('http') ? href : `https://www.mgstage.com${href}`;
        if (!sampleImages.includes(fullUrl)) {
          sampleImages.push(fullUrl);
        }
      }
    });

    // パターン2: サンプル画像リンク内のaタグから拡大画像URLを取得
    $('.sample-box a, .sample-image a, .product-sample a').each((_, elem) => {
      const href = $(elem).attr('href');
      if (href && !shouldExcludeImage(href)) {
        const fullUrl = href.startsWith('http') ? href : `https://www.mgstage.com${href}`;
        if (!sampleImages.includes(fullUrl)) {
          sampleImages.push(fullUrl);
        }
      }
    });

    // パターン3: pics/やsampleを含むリンクのhrefから拡大画像URLを取得
    $('a[href*="pics/"], a[href*="/sample/"]').each((_, elem) => {
      const href = $(elem).attr('href');
      if (href && href.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        const fullUrl = href.startsWith('http') ? href : `https://www.mgstage.com${href}`;
        if (!sampleImages.includes(fullUrl) && !shouldExcludeImage(fullUrl)) {
          sampleImages.push(fullUrl);
        }
      }
    });

    return sampleImages;
  } catch (error) {
    console.error(`  Error fetching ${productUrl}: ${error}`);
    return [];
  }
}

/**
 * サムネイルURLかどうかを判定
 */
function isThumbnailUrl(url: string): boolean {
  // MGSのサムネイルパターン: _120x90, _180x135 など
  return /_\d+x\d+/.test(url) || url.includes('/th/');
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 100;

  console.log('=== MGSサンプル画像バックフィル ===\n');
  console.log(`Dry run: ${dryRun}`);
  console.log(`Limit: ${limit}`);

  // MGSの商品で、product_imagesにサンプル画像があるものを取得
  // まずMGSのproduct_sourcesからproductIdを取得
  const mgsProducts = await db
    .select({
      productId: productSources.productId,
      sourceUrl: productSources.affiliateUrl,
    })
    .from(productSources)
    .where(eq(productSources.aspName, 'mgs'))
    .limit(limit * 10);

  console.log(`\nFound ${mgsProducts.length} MGS products`);

  // サムネイルURLを含むものだけをフィルタ
  const productsToUpdate: Array<{
    productId: number;
    sourceUrl: string;
    imageUrls: string[];
  }> = [];

  for (const product of mgsProducts) {
    if (!product.sourceUrl) continue;

    // このproductのsample画像を取得
    const images = await db
      .select({
        id: productImages.id,
        imageUrl: productImages.imageUrl,
      })
      .from(productImages)
      .where(
        and(
          eq(productImages.productId, product.productId),
          eq(productImages.imageType, 'sample')
        )
      );

    // サムネイルURLを含むかチェック
    const hasThumbnail = images.some(img => isThumbnailUrl(img.imageUrl));

    if (hasThumbnail && images.length > 0) {
      productsToUpdate.push({
        productId: product.productId,
        sourceUrl: product.sourceUrl,
        imageUrls: images.map(img => img.imageUrl),
      });

      if (productsToUpdate.length >= limit) break;
    }
  }

  console.log(`Found ${productsToUpdate.length} products with thumbnail sample images`);

  if (productsToUpdate.length === 0) {
    console.log('No products to update.');
    process.exit(0);
  }

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const product of productsToUpdate) {
    try {
      console.log(`\nProcessing product ${product.productId}: ${product.sourceUrl}`);
      console.log(`  Current images: ${product.imageUrls.length}`);
      console.log(`  Sample: ${product.imageUrls[0]?.substring(0, 80)}...`);

      if (dryRun) {
        console.log(`  [DRY RUN] Would fetch and update sample images`);
        updated++;
        continue;
      }

      // フルサイズ画像を取得
      const fullSizeImages = await fetchFullSizeImages(product.sourceUrl);

      if (fullSizeImages.length === 0) {
        console.log(`  No full-size images found, skipping`);
        skipped++;
        await new Promise(r => setTimeout(r, 500));
        continue;
      }

      console.log(`  Found ${fullSizeImages.length} full-size images`);
      console.log(`  Sample: ${fullSizeImages[0]?.substring(0, 80)}...`);

      // 既存のsample画像を削除
      await db
        .delete(productImages)
        .where(
          and(
            eq(productImages.productId, product.productId),
            eq(productImages.imageType, 'sample')
          )
        );

      // 新しいsample画像を挿入
      const imageInserts = fullSizeImages.map((url, idx) => ({
        productId: product.productId,
        imageUrl: url,
        imageType: 'sample' as const,
        displayOrder: idx,
        aspName: 'mgs',
      }));

      if (imageInserts.length > 0) {
        await db.insert(productImages).values(imageInserts);
      }

      console.log(`  Updated!`);
      updated++;

      await new Promise(r => setTimeout(r, DELAY_MS));
    } catch (error) {
      console.error(`  Error: ${error}`);
      errors++;
    }
  }

  console.log('\n=== 完了 ===');
  console.log(`Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`);

  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
