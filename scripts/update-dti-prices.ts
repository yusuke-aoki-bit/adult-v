/**
 * Update DTI product prices from cached HTML data
 * Run with: npx tsx scripts/update-dti-prices.ts
 */

// Set DATABASE_URL if not already set
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres';
}

import { getDb } from '../lib/db/index';
import { rawHtmlData, productSources, productCache } from '../lib/db/schema';
import { eq, and, or } from 'drizzle-orm';

/**
 * Extract price from HTML content
 */
function extractPrice(html: string): number | null {
  // Pattern 1: var ec_price = parseFloat('50.00');
  const priceMatch = html.match(/var\s+ec_price\s*=\s*parseFloat\s*\(\s*['"](\d+(?:\.\d+)?)['"]\s*\)/);
  if (priceMatch) {
    const usdPrice = parseFloat(priceMatch[1]);
    // Convert USD to JPY (approximate rate: 150)
    return Math.round(usdPrice * 150);
  }

  // Pattern 2: ec_item_price = '50.00' or similar
  const itemPriceMatch = html.match(/ec_item_price\s*=\s*['"]?(\d+(?:\.\d+)?)['"]?/);
  if (itemPriceMatch) {
    const usdPrice = parseFloat(itemPriceMatch[1]);
    return Math.round(usdPrice * 150);
  }

  // Pattern 3: Japanese yen price ¥1,980 or 1,980円
  const yenMatch = html.match(/[¥￥]?\s*(\d{1,3}(?:,\d{3})*)\s*円/);
  if (yenMatch) {
    return parseInt(yenMatch[1].replace(/,/g, ''));
  }

  return null;
}

async function updatePrices() {
  console.log('Starting price update from cached HTML...\n');

  const db = getDb();

  // Get all raw HTML data for DTI sites
  const htmlRecords = await db
    .select()
    .from(rawHtmlData)
    .where(
      or(
        eq(rawHtmlData.source, 'カリビアンコムプレミアム'),
        eq(rawHtmlData.source, '一本道'),
        eq(rawHtmlData.source, 'HEYZO')
      )
    );

  console.log(`Found ${htmlRecords.length} HTML records to process\n`);

  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const record of htmlRecords) {
    try {
      const price = extractPrice(record.htmlContent);

      if (!price) {
        skippedCount++;
        continue;
      }

      // Find and update productSources
      const sourceResult = await db
        .update(productSources)
        .set({ price })
        .where(
          and(
            eq(productSources.aspName, 'DTI'),
            eq(productSources.originalProductId, record.productId)
          )
        )
        .returning({ id: productSources.id });

      // Find and update productCache
      if (sourceResult.length > 0) {
        // Get the productId from productSources
        const sources = await db
          .select()
          .from(productSources)
          .where(
            and(
              eq(productSources.aspName, 'DTI'),
              eq(productSources.originalProductId, record.productId)
            )
          )
          .limit(1);

        if (sources.length > 0) {
          await db
            .update(productCache)
            .set({ price })
            .where(eq(productCache.productId, sources[0].productId));
        }

        updatedCount++;
        if (updatedCount % 50 === 0) {
          console.log(`Progress: ${updatedCount} updated, ${skippedCount} skipped (¥${price} for ${record.productId})`);
        }
      } else {
        skippedCount++;
      }
    } catch (error) {
      errorCount++;
      console.error(`Error processing ${record.productId}:`, error);
    }
  }

  console.log('\n=== Update Complete ===');
  console.log(`Updated: ${updatedCount}`);
  console.log(`Skipped (no price found): ${skippedCount}`);
  console.log(`Errors: ${errorCount}`);

  process.exit(0);
}

updatePrices().catch(console.error);
