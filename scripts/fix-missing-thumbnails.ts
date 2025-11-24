import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';
import * as cheerio from 'cheerio';

/**
 * Fix missing thumbnail URLs by:
 * 1. Reconstructing DUGA thumbnails from affiliate URLs
 * 2. Re-scraping DTI/MGS affiliate pages to extract og:image
 */

async function fixMissingThumbnails() {
  const db = getDb();

  console.log('=== Fixing Missing Thumbnail URLs ===\n');

  // Step 1: Fix DUGA thumbnails from affiliate URL patterns
  console.log('📸 Step 1: Reconstructing DUGA thumbnail URLs...\n');

  const dugaProducts = await db.execute(sql`
    SELECT
      pc.id,
      pc.affiliate_url,
      ps.original_product_id
    FROM product_cache pc
    JOIN product_sources ps ON pc.product_id = ps.product_id AND pc.asp_name = ps.asp_name
    WHERE pc.asp_name = 'DUGA'
    AND (pc.thumbnail_url IS NULL OR pc.thumbnail_url = '')
    AND pc.affiliate_url IS NOT NULL
    LIMIT 1000
  `);

  console.log(`Found ${dugaProducts.rows.length} DUGA products with missing thumbnails`);

  let dugaFixed = 0;
  for (const product of dugaProducts.rows as any[]) {
    // DUGA thumbnail pattern: https://pic.duga.jp/unsecure/{series}/{id}/noauth/jacket_240.jpg
    // Affiliate URL pattern: https://duga.jp/ppv/{series}-{id}/
    const affiliateUrl = product.affiliate_url;
    const match = affiliateUrl.match(/duga\.jp\/ppv\/([^\/]+)\//);

    if (match) {
      const productCode = match[1]; // e.g., "gogos-2139"
      const [series, id] = productCode.split('-');

      if (series && id) {
        const thumbnailUrl = `https://pic.duga.jp/unsecure/${series}/${id}/noauth/jacket_240.jpg`;

        await db.execute(sql`
          UPDATE product_cache
          SET thumbnail_url = ${thumbnailUrl}
          WHERE id = ${product.id}
        `);

        dugaFixed++;
        if (dugaFixed % 100 === 0) {
          console.log(`  Fixed ${dugaFixed} DUGA thumbnails...`);
        }
      }
    }
  }

  console.log(`✅ Fixed ${dugaFixed} DUGA thumbnail URLs\n`);

  // Step 2: Fix DTI sites (カリビアンコム, 一本道, HEYZO, カリビアンコムプレミアム)
  console.log('📸 Step 2: Fixing DTI site thumbnails...\n');

  const dtiProducts = await db.execute(sql`
    SELECT
      pc.id,
      pc.affiliate_url,
      pc.asp_name
    FROM product_cache pc
    WHERE pc.asp_name IN ('DTI', 'カリビアンコム', '一本道', 'HEYZO', 'カリビアンコムプレミアム')
    AND (pc.thumbnail_url IS NULL OR pc.thumbnail_url = '')
    AND pc.affiliate_url IS NOT NULL
    LIMIT 500
  `);

  console.log(`Found ${dtiProducts.rows.length} DTI products with missing thumbnails`);

  let dtiFixed = 0;
  for (const product of dtiProducts.rows as any[]) {
    try {
      // Fetch the affiliate page to extract og:image
      const response = await fetch(product.affiliate_url);
      if (!response.ok) {
        console.log(`  ⚠️ Failed to fetch ${product.affiliate_url}: ${response.status}`);
        continue;
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Try og:image meta tag
      let thumbnailUrl = $('meta[property="og:image"]').attr('content');

      // Fallback: try other image meta tags
      if (!thumbnailUrl) {
        thumbnailUrl = $('meta[name="twitter:image"]').attr('content');
      }

      if (thumbnailUrl) {
        // Ensure absolute URL
        if (!thumbnailUrl.startsWith('http')) {
          const baseUrl = new URL(product.affiliate_url);
          thumbnailUrl = new URL(thumbnailUrl, baseUrl.origin).toString();
        }

        await db.execute(sql`
          UPDATE product_cache
          SET thumbnail_url = ${thumbnailUrl}
          WHERE id = ${product.id}
        `);

        dtiFixed++;
        if (dtiFixed % 50 === 0) {
          console.log(`  Fixed ${dtiFixed} DTI thumbnails...`);
        }
      }

      // Rate limiting - wait 500ms between requests
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.log(`  ⚠️ Error processing ${product.affiliate_url}:`, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  console.log(`✅ Fixed ${dtiFixed} DTI thumbnail URLs\n`);

  // Step 3: Fix MGS thumbnails
  console.log('📸 Step 3: Fixing MGS thumbnails...\n');

  const mgsProducts = await db.execute(sql`
    SELECT
      pc.id,
      pc.affiliate_url,
      ps.original_product_id
    FROM product_cache pc
    JOIN product_sources ps ON pc.product_id = ps.product_id AND pc.asp_name = ps.asp_name
    WHERE pc.asp_name = 'MGS'
    AND (pc.thumbnail_url IS NULL OR pc.thumbnail_url = '')
    AND ps.original_product_id IS NOT NULL
    LIMIT 500
  `);

  console.log(`Found ${mgsProducts.rows.length} MGS products with missing thumbnails`);

  let mgsFixed = 0;
  for (const product of mgsProducts.rows as any[]) {
    try {
      // MGS thumbnail pattern: https://image.mgstage.com/images/doc/{series}/{id}/pb_e_{series}-{id}.jpg
      const productId = product.original_product_id; // e.g., "300MIUM-1135"
      const match = productId.match(/^([A-Z]+)-?(\d+)$/i);

      if (match) {
        const series = match[1].toLowerCase();
        const id = match[2];
        const thumbnailUrl = `https://image.mgstage.com/images/doc/${series}/${productId}/pb_e_${productId}.jpg`;

        await db.execute(sql`
          UPDATE product_cache
          SET thumbnail_url = ${thumbnailUrl}
          WHERE id = ${product.id}
        `);

        mgsFixed++;
        if (mgsFixed % 100 === 0) {
          console.log(`  Fixed ${mgsFixed} MGS thumbnails...`);
        }
      }
    } catch (error) {
      console.log(`  ⚠️ Error processing MGS product ${product.id}:`, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  console.log(`✅ Fixed ${mgsFixed} MGS thumbnail URLs\n`);

  // Final summary
  console.log('=== Summary ===');
  console.log(`DUGA: ${dugaFixed} thumbnails fixed`);
  console.log(`DTI:  ${dtiFixed} thumbnails fixed`);
  console.log(`MGS:  ${mgsFixed} thumbnails fixed`);
  console.log(`Total: ${dugaFixed + dtiFixed + mgsFixed} thumbnails fixed\n`);

  // Check remaining issues
  const remainingIssues = await db.execute(sql`
    SELECT
      asp_name,
      COUNT(*) as total,
      COUNT(CASE WHEN thumbnail_url IS NULL OR thumbnail_url = '' THEN 1 END) as no_thumbnail,
      COUNT(CASE WHEN thumbnail_url IS NOT NULL AND thumbnail_url != '' THEN 1 END) as has_thumbnail
    FROM product_cache
    GROUP BY asp_name
    ORDER BY no_thumbnail DESC
  `);

  console.log('📊 Updated Thumbnail Status by ASP:');
  console.table(remainingIssues.rows);

  process.exit(0);
}

fixMissingThumbnails().catch(console.error);
