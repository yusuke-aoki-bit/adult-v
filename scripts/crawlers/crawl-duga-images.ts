/**
 * DUGA商品ページから画像を取得するクローラー
 * 既存の商品に対して画像情報を追加
 */

import * as cheerio from 'cheerio';
import { getDb } from '../../lib/db';
import { products, productSources, productImages, rawHtmlData } from '../../lib/db/schema';
import { eq, and, isNull, sql } from 'drizzle-orm';
import crypto from 'crypto';

const SOURCE_NAME = 'DUGA';
const BASE_URL = 'https://duga.jp/ppv/';

interface DugaImageData {
  productId: string;
  thumbnailUrl?: string;
  sampleImages: string[];
}

/**
 * DUGAページから画像URLを抽出
 */
async function fetchDugaImages(dugaProductId: string): Promise<DugaImageData | null> {
  try {
    const url = `${BASE_URL}${dugaProductId}/`;
    console.log(`  Fetching: ${url}`);

    const response = await fetch(url);
    if (!response.ok) {
      console.error(`  HTTP error! status: ${response.status}`);
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const imageData: DugaImageData = {
      productId: dugaProductId,
      sampleImages: [],
    };

    // サムネイル画像 (og:image)
    const ogImage = $('meta[property="og:image"]').attr('content');
    if (ogImage) {
      imageData.thumbnailUrl = ogImage.startsWith('http') ? ogImage : `https://duga.jp${ogImage}`;
      console.log(`  Found thumbnail: ${imageData.thumbnailUrl}`);
    }

    // パッケージ画像（商品詳細ページの大きい画像）
    const packageImage = $('.product-image img, .package-image img').first().attr('src');
    if (packageImage && !imageData.thumbnailUrl) {
      imageData.thumbnailUrl = packageImage.startsWith('http') ? packageImage : `https://duga.jp${packageImage}`;
    }

    // サンプル画像を抽出
    $('.sample-gallery img, .preview-images img, .gallery img').each((_, elem) => {
      const src = $(elem).attr('src') || $(elem).attr('data-src');
      if (src) {
        const fullUrl = src.startsWith('http') ? src : `https://duga.jp${src}`;
        // サムネイルボタンや小さい画像を除外
        if (!fullUrl.includes('btn_') && !fullUrl.includes('icon') && !fullUrl.includes('thumbnail')) {
          imageData.sampleImages.push(fullUrl);
        }
      }
    });

    // サンプル画像リンク（<a>タグから）
    $('a[href*="/sample/"], a[href*="gallery"]').each((_, elem) => {
      const img = $(elem).find('img').first();
      const src = img.attr('src') || img.attr('data-src');
      if (src) {
        const fullUrl = src.startsWith('http') ? src : `https://duga.jp${src}`;
        if (!imageData.sampleImages.includes(fullUrl) && !fullUrl.includes('btn_')) {
          imageData.sampleImages.push(fullUrl);
        }
      }
    });

    console.log(`  Found ${imageData.sampleImages.length} sample image(s)`);

    // Save raw HTML for future processing
    const hash = crypto.createHash('sha256').update(html).digest('hex');
    const db = getDb();

    try {
      await db.insert(rawHtmlData).values({
        source: SOURCE_NAME,
        productId: dugaProductId,
        url,
        htmlContent: html,
        hash,
      }).onConflictDoUpdate({
        target: [rawHtmlData.source, rawHtmlData.productId],
        set: {
          htmlContent: html,
          hash,
          crawledAt: new Date(),
        },
      });
    } catch (error) {
      // Ignore duplicate errors
      console.log(`  Raw HTML already saved for ${dugaProductId}`);
    }

    return imageData;
  } catch (error) {
    console.error(`  Error fetching DUGA images for ${dugaProductId}:`, error);
    return null;
  }
}

/**
 * 画像をproduct_imagesテーブルに保存
 */
async function saveProductImages(
  productId: number,
  imageData: DugaImageData,
): Promise<void> {
  const db = getDb();

  try {
    // サムネイルを保存
    if (imageData.thumbnailUrl) {
      const existing = await db
        .select()
        .from(productImages)
        .where(
          and(
            eq(productImages.productId, productId),
            eq(productImages.imageUrl, imageData.thumbnailUrl),
          ),
        )
        .limit(1);

      if (existing.length === 0) {
        await db.insert(productImages).values({
          productId,
          imageUrl: imageData.thumbnailUrl,
          imageType: 'thumbnail',
          displayOrder: 0,
          aspName: SOURCE_NAME,
        });
        console.log(`  Saved thumbnail to product_images`);
      }

      // products.defaultThumbnailUrlも更新
      await db
        .update(products)
        .set({ defaultThumbnailUrl: imageData.thumbnailUrl })
        .where(eq(products.id, productId));
      console.log(`  Updated products.defaultThumbnailUrl`);
    }

    // サンプル画像を保存
    if (imageData.sampleImages.length > 0) {
      for (let i = 0; i < imageData.sampleImages.length; i++) {
        const imageUrl = imageData.sampleImages[i];

        const existing = await db
          .select()
          .from(productImages)
          .where(
            and(
              eq(productImages.productId, productId),
              eq(productImages.imageUrl, imageUrl),
            ),
          )
          .limit(1);

        if (existing.length === 0) {
          await db.insert(productImages).values({
            productId,
            imageUrl,
            imageType: 'sample',
            displayOrder: i + 1,
            aspName: SOURCE_NAME,
          });
        }
      }
      console.log(`  Saved ${imageData.sampleImages.length} sample image(s)`);
    }
  } catch (error) {
    console.error(`  Error saving images for product ${productId}:`, error);
    throw error;
  }
}

/**
 * メイン処理
 */
async function main() {
  const args = process.argv.slice(2);
  const limit = args.includes('--limit')
    ? parseInt(args[args.indexOf('--limit') + 1])
    : undefined;
  const offset = args.includes('--offset')
    ? parseInt(args[args.indexOf('--offset') + 1])
    : 0;

  console.log('🖼️  DUGA Image Crawler\n');
  console.log('='.repeat(80));

  const db = getDb();

  // サムネイルがないDUGA商品を取得
  let query = db
    .select({
      productId: products.id,
      normalizedProductId: products.normalizedProductId,
      dugaProductId: productSources.originalProductId,
    })
    .from(products)
    .innerJoin(productSources, eq(productSources.productId, products.id))
    .where(
      and(
        eq(productSources.aspName, SOURCE_NAME),
        isNull(products.defaultThumbnailUrl),
      ),
    )
    .orderBy(products.id);

  if (limit) {
    query = query.limit(limit).offset(offset) as any;
  }

  const productsToFetch = await query;

  console.log(`Found ${productsToFetch.length} DUGA products without thumbnails\n`);

  if (productsToFetch.length === 0) {
    console.log('✅ All DUGA products already have thumbnails!');
    return;
  }

  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < productsToFetch.length; i++) {
    const product = productsToFetch[i];

    console.log(`\n[${i + 1}/${productsToFetch.length}] Processing product ID ${product.productId}`);
    console.log(`  DUGA ID: ${product.dugaProductId}`);

    try {
      // DUGA商品ページから画像を取得
      const imageData = await fetchDugaImages(product.dugaProductId);

      if (!imageData) {
        console.log(`  ⚠️  Failed to fetch images`);
        errorCount++;
        continue;
      }

      if (!imageData.thumbnailUrl && imageData.sampleImages.length === 0) {
        console.log(`  ⚠️  No images found`);
        skippedCount++;
        continue;
      }

      // 画像を保存
      await saveProductImages(product.productId, imageData);
      successCount++;

      console.log(`  ✓ Success`);

      // レート制限対策（1秒待機）
      if (i < productsToFetch.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`  ❌ Error processing product ${product.productId}:`, error);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 Summary:');
  console.log(`  Total processed: ${productsToFetch.length}`);
  console.log(`  Successful: ${successCount}`);
  console.log(`  Errors: ${errorCount}`);
  console.log(`  Skipped (no images): ${skippedCount}`);
  console.log('='.repeat(80));
}

main()
  .then(() => {
    console.log('\n✅ DUGA image crawler completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Crawler failed:', error);
    process.exit(1);
  });
