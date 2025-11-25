/**
 * Inspect raw HTML data to understand structure
 */

import { getDb } from '../lib/db';
import { rawHtmlData } from '../lib/db/schema';
import { sql } from 'drizzle-orm';
import * as cheerio from 'cheerio';

async function main() {
  const db = getDb();

  // Get sample records from each source
  const sources = await db
    .selectDistinct({ source: rawHtmlData.source })
    .from(rawHtmlData);

  console.log(`Found ${sources.length} distinct sources:\n`);

  for (const { source } of sources) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`SOURCE: ${source}`);
    console.log('='.repeat(60));

    const sample = await db
      .select({
        productId: rawHtmlData.productId,
        url: rawHtmlData.url,
        htmlContent: rawHtmlData.htmlContent,
      })
      .from(rawHtmlData)
      .where(sql`${rawHtmlData.source} = ${source}`)
      .limit(1);

    if (sample.length === 0) continue;

    const record = sample[0];
    console.log(`Product ID: ${record.productId}`);
    console.log(`URL: ${record.url}`);
    console.log(`HTML length: ${record.htmlContent.length} chars\n`);

    const $ = cheerio.load(record.htmlContent);

    // Check for various image tags
    console.log('Image analysis:');
    console.log(`  - meta og:image: ${$('meta[property="og:image"]').attr('content') || 'NOT FOUND'}`);
    console.log(`  - meta og:image:secure_url: ${$('meta[property="og:image:secure_url"]').attr('content') || 'NOT FOUND'}`);

    const allImages = $('img');
    console.log(`  - Total <img> tags: ${allImages.length}`);

    if (allImages.length > 0) {
      console.log('\n  First 5 image sources:');
      allImages.slice(0, 5).each((i, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src') || 'NO SRC';
        const alt = $(el).attr('alt') || '';
        const className = $(el).attr('class') || '';
        console.log(`    ${i + 1}. ${src}`);
        console.log(`       alt="${alt}" class="${className}"`);
      });
    }

    // Check for common container classes
    console.log('\n  Common container patterns:');
    const patterns = [
      '.detail-photo', '.product-image', '.movie-detail',
      '.sample-photo', '.gallery', '.preview',
      '#package-image', '#main-image'
    ];

    for (const pattern of patterns) {
      const found = $(pattern);
      if (found.length > 0) {
        console.log(`    ✓ Found: ${pattern} (${found.length} elements)`);
      }
    }

    console.log(`\n  Sample HTML snippet (first 2000 chars):`);
    console.log(record.htmlContent.substring(0, 2000));
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
