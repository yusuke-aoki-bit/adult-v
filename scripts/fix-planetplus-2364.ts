/**
 * Fix specific planetplus-2364 manufacturer code
 */

import { getDb } from '../lib/db';
import { productSources } from '../lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import * as cheerio from 'cheerio';

async function fetchManufacturerCode(productId: string): Promise<string | null> {
  try {
    const url = `https://duga.jp/ppv/${productId}/`;
    console.log(`Fetching: ${url}`);

    const response = await fetch(url);
    if (!response.ok) {
      console.error(`  ❌ Failed: ${response.status}`);
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const manufacturerCode = $('span[itemprop="mpn"]').text().trim();
    console.log(`  Found: ${manufacturerCode || '(none)'}`);

    return manufacturerCode || null;
  } catch (error) {
    console.error(`  ❌ Error:`, error);
    return null;
  }
}

async function fixProduct() {
  const db = getDb();

  const productId = 'planetplus-2364';
  console.log(`Fixing ${productId}...\n`);

  // Fetch the manufacturer code
  const manufacturerCode = await fetchManufacturerCode(productId);

  if (!manufacturerCode) {
    console.error('\n❌ Could not fetch manufacturer code');
    process.exit(1);
  }

  console.log(`\nUpdating database: ${productId} → ${manufacturerCode}`);

  // Update the product_sources table
  const result = await db.execute(sql`
    UPDATE product_sources
    SET original_product_id = ${manufacturerCode}
    WHERE asp_name = 'DUGA'
      AND original_product_id = ${productId}
  `);

  console.log(`\n✅ Updated successfully!`);

  // Verify the update
  const verification = await db.execute(sql`
    SELECT
      p.id,
      p.normalized_product_id,
      ps.original_product_id
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    WHERE p.normalized_product_id = ${productId}
  `);

  console.log('\nVerification:');
  console.log(JSON.stringify(verification.rows, null, 2));
}

fixProduct().then(() => process.exit(0));
