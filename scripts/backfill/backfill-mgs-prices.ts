/**
 * Backfill MGS prices
 * Re-fetches MGS product pages and updates prices for existing products
 */

import { db } from '../../lib/db';
import { productSources } from '../../lib/db/schema';
import { eq, and, isNull, sql } from 'drizzle-orm';
import * as cheerio from 'cheerio';

const DELAY_MS = 1000; // Delay between requests to be polite to the server
const BATCH_SIZE = 50;

async function fetchProductPrice(productId: string): Promise<number | null> {
  const url = `https://www.mgstage.com/product/product_detail/${productId}/`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cookie': 'adc=1',
        'Accept-Language': 'ja-JP,ja;q=0.9',
      },
    });

    if (!response.ok) {
      console.log(`  ❌ HTTP ${response.status} for ${productId}`);
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Check if we got the age verification page
    if (html.includes('年齢認証') && html.includes('18歳以上')) {
      console.log(`  ⚠️ Age verification page for ${productId}`);
      return null;
    }

    // Try to extract price from download_hd_price span (primary price)
    const downloadHdPriceText = $('#download_hd_price').text().trim();
    if (downloadHdPriceText) {
      const priceMatch = downloadHdPriceText.match(/(\d+(?:,\d+)*)/);
      if (priceMatch) {
        return parseInt(priceMatch[1].replace(/,/g, ''));
      }
    }

    // Fallback: extract from radio button value
    const priceInput = $('input[name="price"][id="download_hd_btn"]');
    const priceValue = priceInput.attr('value');
    if (priceValue) {
      const parts = priceValue.split(',');
      if (parts.length >= 5) {
        const extractedPrice = parseInt(parts[4]);
        if (!isNaN(extractedPrice) && extractedPrice > 0) {
          return extractedPrice;
        }
      }
    }

    // Fallback 2: try streaming price
    const streamingPriceText = $('#streaming_price').text().trim();
    if (streamingPriceText) {
      const priceMatch = streamingPriceText.match(/(\d+(?:,\d+)*)/);
      if (priceMatch) {
        return parseInt(priceMatch[1].replace(/,/g, ''));
      }
    }

    console.log(`  ⚠️ No price found for ${productId}`);
    return null;
  } catch (error) {
    console.error(`  ❌ Error fetching ${productId}:`, error);
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 100;
  const dryRun = args.includes('--dry-run');

  console.log('=== Backfill MGS Prices ===');
  console.log(`Limit: ${limit}`);
  console.log(`Dry run: ${dryRun}`);

  // Get MGS products without prices
  const productsWithoutPrices = await db.execute(sql`
    SELECT id, original_product_id
    FROM product_sources
    WHERE asp_name = 'MGS'
    AND price IS NULL
    ORDER BY id DESC
    LIMIT ${limit}
  `);

  console.log(`\nFound ${productsWithoutPrices.rows.length} MGS products without prices`);

  let updated = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < productsWithoutPrices.rows.length; i += BATCH_SIZE) {
    const batch = productsWithoutPrices.rows.slice(i, i + BATCH_SIZE);
    console.log(`\nProcessing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(productsWithoutPrices.rows.length / BATCH_SIZE)}`);

    for (const row of batch) {
      const r = row as { id: number; original_product_id: string };
      const productId = r.original_product_id;

      console.log(`Processing ${productId}...`);
      const price = await fetchProductPrice(productId);

      if (price !== null) {
        if (!dryRun) {
          await db
            .update(productSources)
            .set({
              price,
              lastUpdated: new Date(),
            })
            .where(eq(productSources.id, r.id));
        }
        console.log(`  ✅ Updated price: ¥${price.toLocaleString()}`);
        updated++;
      } else {
        failed++;
      }

      // Delay between requests
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Updated: ${updated}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total processed: ${updated + failed}`);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
