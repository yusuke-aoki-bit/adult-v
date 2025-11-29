/**
 * Extract and backfill product images from existing raw_html_data
 * This script processes stored HTML to populate product_images table
 */

import * as cheerio from 'cheerio';
import { getDb } from '../lib/db';
import { rawHtmlData, products, productImages } from '../lib/db/schema';
import { eq, and, isNull, sql } from 'drizzle-orm';

interface ImageExtractionResult {
  thumbnailUrl?: string;
  sampleImages: string[];
}

/**
 * Normalize URL (handle protocol-relative URLs and relative URLs)
 */
function normalizeUrl(url: string | undefined, baseUrl?: string): string | undefined {
  if (!url) return undefined;

  // Protocol-relative URL (e.g., //www.heyzo.com/image.jpg)
  if (url.startsWith('//')) {
    return 'https:' + url;
  }

  // Relative URL (e.g., /images/thumb.jpg)
  if (!url.startsWith('http') && baseUrl) {
    try {
      return new URL(url, baseUrl).href;
    } catch {
      return undefined;
    }
  }

  // Already absolute URL
  if (url.startsWith('http')) {
    return url;
  }

  return undefined;
}

/**
 * Extract images from MGS HTML
 */
function extractMgsImages(html: string, productId: string): ImageExtractionResult {
  const $ = cheerio.load(html);
  const result: ImageExtractionResult = { sampleImages: [] };

  // サムネイル画像
  const thumbnail = $('meta[property="og:image"]').attr('content') ||
                    $('.detail-photo img').first().attr('src') ||
                    $('img[alt*="パッケージ"]').first().attr('src');

  const normalizedThumbnail = normalizeUrl(thumbnail);
  if (normalizedThumbnail) {
    result.thumbnailUrl = normalizedThumbnail;
  }

  // サンプル画像
  $('.sample-photo img, .detail-sample img, .gallery img').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src');
    const normalized = normalizeUrl(src);
    if (normalized && !normalized.includes('btn_') && !normalized.includes('icon')) {
      result.sampleImages.push(normalized);
    }
  });

  return result;
}

/**
 * Extract images from DTI sites HTML (Caribbeancom, 1Pondo, HEYZO, etc.)
 */
function extractDtiImages(html: string, productId: string, source: string): ImageExtractionResult {
  const $ = cheerio.load(html);
  const result: ImageExtractionResult = { sampleImages: [] };

  // サムネイル
  const thumbnail = $('meta[property="og:image"]').attr('content') ||
                    $('.movie-detail img').first().attr('src') ||
                    $('img.movie-thumb').first().attr('src');

  const normalizedThumbnail = normalizeUrl(thumbnail);
  if (normalizedThumbnail) {
    result.thumbnailUrl = normalizedThumbnail;
  }

  // サンプル画像
  $('.gallery img, .sample-images img, .preview-images img').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src');
    const normalized = normalizeUrl(src);
    if (normalized) {
      result.sampleImages.push(normalized);
    }
  });

  return result;
}

/**
 * Extract images from DUGA HTML
 */
function extractDugaImages(html: string, productId: string): ImageExtractionResult {
  const $ = cheerio.load(html);
  const result: ImageExtractionResult = { sampleImages: [] };

  // サムネイル
  const thumbnail = $('meta[property="og:image"]').attr('content') ||
                    $('.product-image img').first().attr('src');

  const normalizedThumbnail = normalizeUrl(thumbnail);
  if (normalizedThumbnail) {
    result.thumbnailUrl = normalizedThumbnail;
  }

  // サンプル画像
  $('.sample-gallery img, .preview img').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src');
    const normalized = normalizeUrl(src);
    if (normalized) {
      result.sampleImages.push(normalized);
    }
  });

  return result;
}

/**
 * Extract images from av-wiki HTML
 */
function extractAvWikiImages(html: string, productId: string): ImageExtractionResult {
  const $ = cheerio.load(html);
  const result: ImageExtractionResult = { sampleImages: [] };

  // av-wiki has DMM product images
  const dmmImage = $('img[src*="pics.dmm.co.jp"]').first().attr('src');
  const normalized = normalizeUrl(dmmImage);
  if (normalized) {
    result.thumbnailUrl = normalized;
  }

  return result;
}

/**
 * Generic image extraction fallback
 */
function extractGenericImages(html: string): ImageExtractionResult {
  const $ = cheerio.load(html);
  const result: ImageExtractionResult = { sampleImages: [] };

  // Try og:image first
  const ogImage = $('meta[property="og:image"]').attr('content');
  const normalizedOgImage = normalizeUrl(ogImage);
  if (normalizedOgImage) {
    result.thumbnailUrl = normalizedOgImage;
  }

  return result;
}

/**
 * Process a single raw HTML record
 */
async function processRawHtml(
  db: ReturnType<typeof getDb>,
  record: { productId: string; source: string; htmlContent: string; id: number }
): Promise<{ success: boolean; thumbnailSaved: boolean; samplesSaved: number }> {

  let images: ImageExtractionResult;

  // Extract images based on source
  const sourceUpper = record.source.toUpperCase();

  if (sourceUpper === 'MGS') {
    images = extractMgsImages(record.htmlContent, record.productId);
  } else if (sourceUpper === 'HEYZO') {
    images = extractDtiImages(record.htmlContent, record.productId, record.source);
  } else if (sourceUpper === 'カリビアンコムプレミアム' || sourceUpper === '一本道') {
    images = extractDtiImages(record.htmlContent, record.productId, record.source);
  } else if (sourceUpper === 'DUGA') {
    images = extractDugaImages(record.htmlContent, record.productId);
  } else if (sourceUpper === 'AV-WIKI') {
    images = extractAvWikiImages(record.htmlContent, record.productId);
  } else {
    images = extractGenericImages(record.htmlContent);
  }

  let thumbnailSaved = false;
  let samplesSaved = 0;

  // Find the actual product ID in database
  const product = await db
    .select({ id: products.id })
    .from(products)
    .where(
      sql`LOWER(REPLACE(${products.normalizedProductId}, '-', '')) = LOWER(REPLACE(${record.productId}, '-', ''))`
    )
    .limit(1);

  if (product.length === 0) {
    return { success: false, thumbnailSaved: false, samplesSaved: 0 };
  }

  const dbProductId = product[0].id;

  // Save thumbnail
  if (images.thumbnailUrl) {
    const existing = await db
      .select()
      .from(productImages)
      .where(
        and(
          eq(productImages.productId, dbProductId),
          eq(productImages.imageType, 'thumbnail')
        )
      )
      .limit(1);

    if (existing.length === 0) {
      await db.insert(productImages).values({
        productId: dbProductId,
        imageUrl: images.thumbnailUrl,
        imageType: 'thumbnail',
        displayOrder: 0,
        aspName: record.source,
      });

      // Also update products.default_thumbnail_url
      await db.update(products)
        .set({ defaultThumbnailUrl: images.thumbnailUrl })
        .where(eq(products.id, dbProductId));

      thumbnailSaved = true;
    }
  }

  // Save sample images
  for (let i = 0; i < images.sampleImages.length; i++) {
    const imageUrl = images.sampleImages[i];

    const existing = await db
      .select()
      .from(productImages)
      .where(
        and(
          eq(productImages.productId, dbProductId),
          eq(productImages.imageUrl, imageUrl)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      await db.insert(productImages).values({
        productId: dbProductId,
        imageUrl,
        imageType: 'sample',
        displayOrder: i + 1,
        aspName: record.source,
      });
      samplesSaved++;
    }
  }

  return { success: true, thumbnailSaved, samplesSaved };
}

/**
 * Main backfill process
 */
async function main() {
  const args = process.argv.slice(2);
  const batchSize = parseInt(args[0]) || 100;
  const maxRecords = parseInt(args[1]) || 10000;

  console.log('🖼️  Starting image backfill from raw_html_data...');
  console.log(`Batch size: ${batchSize}, Max records: ${maxRecords}\n`);

  const db = getDb();

  let processed = 0;
  let thumbnailsSaved = 0;
  let sampleImagesSaved = 0;
  let errors = 0;
  let offset = 0;

  while (processed < maxRecords) {
    // Fetch batch of raw HTML records
    const records = await db
      .select({
        id: rawHtmlData.id,
        productId: rawHtmlData.productId,
        source: rawHtmlData.source,
        htmlContent: rawHtmlData.htmlContent,
      })
      .from(rawHtmlData)
      .where(sql`LENGTH(${rawHtmlData.htmlContent}) > 1000`)
      .limit(batchSize)
      .offset(offset);

    if (records.length === 0) {
      console.log('\nNo more records to process.');
      break;
    }

    console.log(`\nProcessing batch ${Math.floor(offset / batchSize) + 1} (${records.length} records)...`);

    for (const record of records) {
      try {
        const result = await processRawHtml(db, record);

        if (result.success) {
          if (result.thumbnailSaved) thumbnailsSaved++;
          sampleImagesSaved += result.samplesSaved;

          if ((thumbnailsSaved + sampleImagesSaved) % 10 === 0) {
            console.log(`  Progress: ${processed}/${maxRecords} | Thumbnails: ${thumbnailsSaved} | Samples: ${sampleImagesSaved}`);
          }
        }
      } catch (error) {
        errors++;
        if (errors % 10 === 0) {
          console.log(`  ⚠️  Errors: ${errors}`);
        }
      }

      processed++;

      if (processed >= maxRecords) {
        break;
      }
    }

    offset += batchSize;

    // Progress report every batch
    console.log(`Batch complete: ${processed}/${maxRecords} records processed`);
  }

  console.log('\n========================================');
  console.log('Image Backfill Summary:');
  console.log(`  Processed: ${processed} raw HTML records`);
  console.log(`  Thumbnails saved: ${thumbnailsSaved}`);
  console.log(`  Sample images saved: ${sampleImagesSaved}`);
  console.log(`  Errors: ${errors}`);
  console.log('========================================');
}

main()
  .then(() => {
    console.log('\n✅ Backfill completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Backfill failed:', error);
    process.exit(1);
  });
