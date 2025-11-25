/**
 * Debug backfill to see what's happening
 */
import * as cheerio from 'cheerio';
import { getDb } from '../lib/db';
import { rawHtmlData, products } from '../lib/db/schema';
import { sql } from 'drizzle-orm';

function normalizeUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('//')) return 'https:' + url;
  if (url.startsWith('http')) return url;
  return undefined;
}

async function main() {
  const db = getDb();

  // Get a few records from each source
  const samples = await db
    .select({
      id: rawHtmlData.id,
      productId: rawHtmlData.productId,
      source: rawHtmlData.source,
      htmlContent: rawHtmlData.htmlContent,
    })
    .from(rawHtmlData)
    .where(sql`LENGTH(${rawHtmlData.htmlContent}) > 1000`)
    .limit(10);

  for (const record of samples) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Source: ${record.source}`);
    console.log(`Product ID from raw_html: "${record.productId}"`);

    // Try to find product
    const product = await db
      .select({ id: products.id, normalizedProductId: products.normalizedProductId })
      .from(products)
      .where(
        sql`LOWER(REPLACE(${products.normalizedProductId}, '-', '')) = LOWER(REPLACE(${record.productId}, '-', ''))`
      )
      .limit(1);

    if (product.length === 0) {
      console.log(`❌ Product NOT FOUND in products table`);

      // Try exact match
      const exact = await db
        .select({ id: products.id, normalizedProductId: products.normalizedProductId })
        .from(products)
        .where(sql`${products.normalizedProductId} = ${record.productId}`)
        .limit(1);

      if (exact.length > 0) {
        console.log(`  But found exact match: ID=${exact[0].id}, normalizedProductId="${exact[0].normalizedProductId}"`);
      } else {
        console.log(`  Checking similar products...`);
        const similar = await db
          .select({ id: products.id, normalizedProductId: products.normalizedProductId })
          .from(products)
          .where(sql`${products.normalizedProductId} LIKE '%${record.productId}%'`)
          .limit(3);

        if (similar.length > 0) {
          console.log(`  Found similar:`);
          similar.forEach(p => console.log(`    - ID=${p.id}, normalizedProductId="${p.normalizedProductId}"`));
        } else {
          console.log(`  No similar products found either`);
        }
      }
    } else {
      console.log(`✅ Product FOUND: ID=${product[0].id}, normalizedProductId="${product[0].normalizedProductId}"`);

      // Try extracting image
      const $ = cheerio.load(record.htmlContent);
      let thumbnail: string | undefined;

      if (record.source === 'HEYZO') {
        thumbnail = $('meta[property="og:image"]').attr('content');
        console.log(`  HEYZO og:image: "${thumbnail}"`);
        const normalized = normalizeUrl(thumbnail);
        console.log(`  Normalized: "${normalized}"`);
      } else if (record.source === 'av-wiki') {
        thumbnail = $('img[src*="pics.dmm.co.jp"]').first().attr('src');
        console.log(`  av-wiki DMM image: "${thumbnail}"`);
      } else {
        thumbnail = $('meta[property="og:image"]').attr('content');
        console.log(`  og:image: "${thumbnail}"`);
      }
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
