/**
 * Backfill script to fetch and save sample images for existing 一本道 products
 * that only have thumbnails but no sample images in product_images table
 */

import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';
import { productImages } from '../lib/db/schema';

async function fetch1pondoSampleImages(productId: string): Promise<{
  sampleImages: string[];
} | null> {
  const galleryZipUrl = `https://www.1pondo.tv/assets/sample/${productId}/gallery.zip`;

  try {
    console.log(`  Fetching gallery.zip...`);
    const response = await fetch(galleryZipUrl);
    if (!response.ok) {
      return null;
    }

    const zipBuffer = Buffer.from(await response.arrayBuffer());
    const AdmZip = (await import('adm-zip')).default;
    const zip = new AdmZip(zipBuffer);
    const zipEntries = zip.getEntries();

    const sampleImages: string[] = [];
    for (const entry of zipEntries) {
      if (!entry.isDirectory && entry.entryName.match(/\.(jpg|jpeg|png)$/i)) {
        // Construct full URL for each image
        const imageUrl = `https://www.1pondo.tv/assets/sample/${productId}/${entry.entryName}`;
        sampleImages.push(imageUrl);
      }
    }

    return { sampleImages };
  } catch (error) {
    console.error(`  Error fetching gallery.zip for ${productId}:`, error);
    return null;
  }
}

async function main() {
  const db = getDb();

  console.log('🔍 Finding 一本道 products without sample images...\n');

  // Find all 一本道 products that only have thumbnails
  const productsWithoutSamples = await db.execute(sql`
    SELECT
      p.id,
      ps.original_product_id,
      p.title,
      COUNT(CASE WHEN pi.image_type = 'thumbnail' THEN 1 END) as thumb_count,
      COUNT(CASE WHEN pi.image_type = 'sample' THEN 1 END) as sample_count
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    LEFT JOIN product_images pi ON p.id = pi.product_id
    WHERE ps.asp_name = 'DTI'
      AND p.normalized_product_id LIKE '一本道%'
    GROUP BY p.id, ps.original_product_id, p.title
    HAVING COUNT(CASE WHEN pi.image_type = 'sample' THEN 1 END) = 0
    ORDER BY p.id
  `);

  console.log(`Found ${productsWithoutSamples.rows.length} 一本道 products without sample images\n`);

  if (productsWithoutSamples.rows.length === 0) {
    console.log('✅ All 一本道 products already have sample images!');
    process.exit(0);
  }

  let processed = 0;
  let successCount = 0;
  let failCount = 0;

  for (const row of productsWithoutSamples.rows as any[]) {
    const productId = row.id;
    const originalProductId = row.original_product_id;
    const title = row.title;

    processed++;
    console.log(`[${processed}/${productsWithoutSamples.rows.length}] Processing: ${originalProductId}`);
    console.log(`  Title: ${title.substring(0, 50)}...`);

    // Fetch sample images from gallery.zip
    const imageData = await fetch1pondoSampleImages(originalProductId);

    if (!imageData || !imageData.sampleImages || imageData.sampleImages.length === 0) {
      console.log(`  ⚠️  No sample images found in gallery.zip`);
      failCount++;
      continue;
    }

    console.log(`  ✓ Found ${imageData.sampleImages.length} sample images`);

    // Save sample images to product_images table
    let savedCount = 0;
    for (let i = 0; i < imageData.sampleImages.length; i++) {
      const imageUrl = imageData.sampleImages[i];

      // Check if already exists
      const existing = await db.execute(sql`
        SELECT id FROM product_images
        WHERE product_id = ${productId}
          AND image_url = ${imageUrl}
        LIMIT 1
      `);

      if (existing.rows.length === 0) {
        await db.insert(productImages).values({
          productId,
          imageUrl,
          imageType: 'sample',
          displayOrder: i + 1,
          aspName: 'DTI',
        });
        savedCount++;
      }
    }

    if (savedCount > 0) {
      console.log(`  💾 Saved ${savedCount} new sample images`);
      successCount++;
    } else {
      console.log(`  ℹ️  All sample images already existed`);
    }

    // Rate limiting: 500ms between requests
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.log('\n=== Summary ===');
  console.log(`Total products processed: ${processed}`);
  console.log(`✅ Successfully added sample images: ${successCount}`);
  console.log(`❌ Failed to fetch sample images: ${failCount}`);

  process.exit(0);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
