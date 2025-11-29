/**
 * Backfill missing DUGA manufacturer codes
 * Fetches メーカー品番 from DUGA product pages and updates product_sources
 * Run with: DATABASE_URL="..." npx tsx scripts/backfill-duga-manufacturer-codes.ts
 */

import { getDb } from '../lib/db';
import { productSources } from '../lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import * as cheerio from 'cheerio';

/**
 * DUGAの商品ページからメーカー品番をスクレイピング
 */
async function fetchManufacturerCode(productId: string): Promise<string | null> {
  try {
    const url = `https://duga.jp/ppv/${productId}/`;

    const response = await fetch(url);
    if (!response.ok) {
      console.error(`  ❌ Failed to fetch ${url}: ${response.status}`);
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // メーカー品番を取得: <span itemprop="mpn">GS-2131</span>
    const manufacturerCode = $('span[itemprop="mpn"]').text().trim();

    if (!manufacturerCode) {
      return null;
    }

    return manufacturerCode;
  } catch (error) {
    console.error(`  ❌ Error scraping ${productId}:`, error);
    return null;
  }
}

async function backfillManufacturerCodes() {
  const db = getDb();

  console.log('Finding DUGA products where original_product_id matches normalized_product_id...\n');

  // Find products where original_product_id looks like a DUGA ID (not a manufacturer code)
  // Manufacturer codes typically have hyphens and uppercase letters (e.g. ZMAR-148)
  // DUGA IDs are like "planetplus-2364", "heavens-0051"
  const results = await db.execute(sql`
    SELECT
      ps.id as source_id,
      ps.original_product_id,
      p.normalized_product_id
    FROM product_sources ps
    JOIN products p ON ps.product_id = p.id
    WHERE ps.asp_name = 'DUGA'
      AND ps.original_product_id = p.normalized_product_id
      AND ps.original_product_id LIKE '%-%'
    ORDER BY ps.id
    LIMIT 100
  `);

  const productsToUpdate = results.rows as Array<{
    source_id: number;
    original_product_id: string;
    normalized_product_id: string;
  }>;

  console.log(`Found ${productsToUpdate.length} products to check\n`);

  let successCount = 0;
  let failCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < productsToUpdate.length; i++) {
    const product = productsToUpdate[i];
    const dugaProductId = product.normalized_product_id;

    console.log(`[${i + 1}/${productsToUpdate.length}] Checking ${dugaProductId}...`);

    const manufacturerCode = await fetchManufacturerCode(dugaProductId);

    if (manufacturerCode && manufacturerCode !== dugaProductId) {
      // Update the original_product_id with the actual manufacturer code
      await db
        .update(productSources)
        .set({ originalProductId: manufacturerCode })
        .where(eq(productSources.id, product.source_id));

      console.log(`  ✅ Updated: ${dugaProductId} → ${manufacturerCode}`);
      successCount++;
    } else if (!manufacturerCode) {
      console.log(`  ⚠️  No manufacturer code found for ${dugaProductId}`);
      failCount++;
    } else {
      console.log(`  ⏭️  Skipped: ${dugaProductId} (manufacturer code same as product ID)`);
      skippedCount++;
    }

    // Rate limiting: wait 500ms between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n========================================');
  console.log('Backfill completed!');
  console.log(`  ✅ Updated: ${successCount}`);
  console.log(`  ⚠️  Failed: ${failCount}`);
  console.log(`  ⏭️  Skipped: ${skippedCount}`);
  console.log('========================================\n');
}

backfillManufacturerCodes().then(() => process.exit(0));
