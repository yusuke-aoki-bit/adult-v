/**
 * Check how many products have STARS/ABP in product IDs
 */

import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function checkProductIds() {
  const db = getDb();

  console.log('=== Product ID Search Analysis ===\n');

  // Count products with STARS in product_id
  const starsCount = await db.execute(sql`
    SELECT COUNT(DISTINCT p.id) as count
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    WHERE ps.original_product_id LIKE '%STARS%'
      AND ps.asp_name != 'DTI'
  `);

  console.log(`Products with STARS in original_product_id: ${starsCount.rows[0].count}`);

  // Count products with ABP in product_id
  const abpCount = await db.execute(sql`
    SELECT COUNT(DISTINCT p.id) as count
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    WHERE ps.original_product_id LIKE '%ABP%'
      AND ps.asp_name != 'DTI'
  `);

  console.log(`Products with ABP in original_product_id: ${abpCount.rows[0].count}\n`);

  // Sample products
  console.log('Sample STARS products:');
  const starsSamples = await db.execute(sql`
    SELECT ps.original_product_id, p.title, p.normalized_product_id
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    WHERE ps.original_product_id LIKE '%STARS%'
      AND ps.asp_name != 'DTI'
    LIMIT 5
  `);

  for (const row of starsSamples.rows) {
    console.log(`  ${row.original_product_id} - ${row.title.substring(0, 50)}...`);
  }

  console.log('\nSample ABP products:');
  const abpSamples = await db.execute(sql`
    SELECT ps.original_product_id, p.title, p.normalized_product_id
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    WHERE ps.original_product_id LIKE '%ABP%'
      AND ps.asp_name != 'DTI'
    LIMIT 5
  `);

  for (const row of abpSamples.rows) {
    console.log(`  ${row.original_product_id} - ${row.title.substring(0, 50)}...`);
  }

  // Check if product_id is in title
  console.log('\n=== Are product IDs in title? ===\n');

  const starsInTitle = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    WHERE ps.original_product_id LIKE '%STARS%'
      AND p.title LIKE '%STARS%'
      AND ps.asp_name != 'DTI'
  `);

  console.log(`STARS products with "STARS" in title: ${starsInTitle.rows[0].count} / ${starsCount.rows[0].count}`);

  const abpInTitle = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    WHERE ps.original_product_id LIKE '%ABP%'
      AND p.title LIKE '%ABP%'
      AND ps.asp_name != 'DTI'
  `);

  console.log(`ABP products with "ABP" in title: ${abpInTitle.rows[0].count} / ${abpCount.rows[0].count}`);
}

checkProductIds().then(() => process.exit(0));
