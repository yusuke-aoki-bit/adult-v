import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';
import * as cheerio from 'cheerio';

async function extractMediaFromRawData() {
  const db = getDb();

  console.log('=== Extracting media URLs from raw_html_data ===\n');

  // Get all raw HTML records
  const rawHtmlRecords = await db.execute(sql`
    SELECT id, source, product_id, html_content
    FROM raw_html_data
    ORDER BY source, product_id
  `);

  console.log(`Found ${rawHtmlRecords.rows.length} HTML records to process\n`);

  let processedCount = 0;
  let imagesExtracted = 0;
  let videosExtracted = 0;
  let productsUpdated = 0;

  for (const record of rawHtmlRecords.rows) {
    const { source, product_id, html_content } = record as any;

    try {
      const $ = cheerio.load(html_content);
      const images: string[] = [];
      const videos: string[] = [];

      // Extract image URLs based on source
      if (source === 'MGS') {
        // MGS specific image extraction
        $('img').each((_, el) => {
          const src = $(el).attr('src') || $(el).attr('data-src');
          if (src && (src.includes('mgstage.com') || src.includes('prestige-av.com'))) {
            images.push(src);
          }
        });
      } else if (source === 'HEYZO') {
        // HEYZO specific image extraction
        $('img').each((_, el) => {
          const src = $(el).attr('src');
          if (src && src.includes('heyzo.com')) {
            images.push(src);
          }
        });
      } else if (source === '一本道' || source === 'カリビアンコムプレミアム') {
        // DTI sites image extraction
        $('img').each((_, el) => {
          const src = $(el).attr('src');
          if (src && (src.includes('1pondo.tv') || src.includes('caribbeancom.com'))) {
            images.push(src);
          }
        });
      }

      // Find the product in database
      const productResult = await db.execute(sql`
        SELECT id FROM products WHERE id = ${product_id} LIMIT 1
      `);

      if (productResult.rows.length === 0) {
        console.log(`Skipping ${product_id}: Product not found in database`);
        continue;
      }

      const dbProductId = (productResult.rows[0] as any).id;

      // Insert images into product_images table
      for (let i = 0; i < images.length; i++) {
        const imageUrl = images[i];

        try {
          await db.execute(sql`
            INSERT INTO product_images (product_id, image_url, image_type, display_order, asp_name)
            VALUES (${dbProductId}, ${imageUrl}, 'thumbnail', ${i}, ${source})
            ON CONFLICT (product_id, image_url) DO NOTHING
          `);
          imagesExtracted++;
        } catch (err) {
          console.error(`Error inserting image for ${product_id}:`, err);
        }
      }

      // Update product default_thumbnail_url with first image
      if (images.length > 0) {
        try {
          await db.execute(sql`
            UPDATE products
            SET default_thumbnail_url = ${images[0]}
            WHERE id = ${dbProductId} AND default_thumbnail_url IS NULL
          `);
          productsUpdated++;
        } catch (err) {
          console.error(`Error updating thumbnail for ${product_id}:`, err);
        }
      }

      processedCount++;

      if (processedCount % 100 === 0) {
        console.log(`Processed ${processedCount}/${rawHtmlRecords.rows.length} records...`);
      }

    } catch (err) {
      console.error(`Error processing ${product_id}:`, err);
    }
  }

  console.log('\n=== Extraction Complete ===');
  console.log(`Processed: ${processedCount} HTML records`);
  console.log(`Images extracted: ${imagesExtracted}`);
  console.log(`Videos extracted: ${videosExtracted}`);
  console.log(`Products updated with thumbnails: ${productsUpdated}`);

  process.exit(0);
}

extractMediaFromRawData();
