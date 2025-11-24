/**
 * Check data collection status for all sources
 */

import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function checkCollectionStatus() {
  const db = getDb();

  console.log('========================================');
  console.log('DATA COLLECTION STATUS');
  console.log('========================================\n');

  try {
    // Check raw_html_data by source
    console.log('1. RAW HTML DATA');
    console.log('----------------------------------------');

    const htmlData = await db.execute(sql`
      SELECT
        source,
        COUNT(*) as total_records,
        COUNT(DISTINCT hash) as unique_hashes,
        MIN(crawled_at) as first_crawl,
        MAX(crawled_at) as last_crawl
      FROM raw_html_data
      GROUP BY source
      ORDER BY total_records DESC
    `);

    for (const row of htmlData.rows) {
      console.log(`\n📄 ${row.source}`);
      console.log(`   Total: ${row.total_records}`);
      console.log(`   Unique: ${row.unique_hashes}`);
      console.log(`   First: ${row.first_crawl}`);
      console.log(`   Last: ${row.last_crawl}`);
    }

    // Check raw_csv_data by source
    console.log('\n\n2. RAW CSV DATA');
    console.log('----------------------------------------');

    const csvData = await db.execute(sql`
      SELECT
        source,
        COUNT(*) as total_records,
        COUNT(DISTINCT hash) as unique_hashes,
        MIN(downloaded_at) as first_download,
        MAX(downloaded_at) as last_download
      FROM raw_csv_data
      GROUP BY source
      ORDER BY total_records DESC
    `);

    for (const row of csvData.rows) {
      console.log(`\n📄 ${row.source}`);
      console.log(`   Total: ${row.total_records}`);
      console.log(`   Unique: ${row.unique_hashes}`);
      console.log(`   First: ${row.first_download}`);
      console.log(`   Last: ${row.last_download}`);
    }

    // Check product_sources by ASP
    console.log('\n\n3. PRODUCT SOURCES (by ASP)');
    console.log('----------------------------------------');

    const productSources = await db.execute(sql`
      SELECT
        asp_name,
        COUNT(*) as total_products,
        COUNT(DISTINCT product_id) as unique_products,
        COUNT(CASE WHEN affiliate_url IS NOT NULL THEN 1 END) as with_affiliate
      FROM product_sources
      GROUP BY asp_name
      ORDER BY total_products DESC
    `);

    for (const row of productSources.rows) {
      console.log(`\n💼 ${row.asp_name}`);
      console.log(`   Total: ${row.total_products}`);
      console.log(`   Unique Products: ${row.unique_products}`);
      console.log(`   With Affiliate: ${row.with_affiliate}`);
    }

    // Check products count
    console.log('\n\n4. PRODUCTS TABLE');
    console.log('----------------------------------------');

    const productsCount = await db.execute(sql`
      SELECT COUNT(*) as total FROM products
    `);

    console.log(`\nTotal Products: ${productsCount.rows[0].total}`);

    // Check site tags distribution
    console.log('\n\n5. SITE TAGS DISTRIBUTION');
    console.log('----------------------------------------');

    const siteTags = await db.execute(sql`
      SELECT
        t.name as tag_name,
        COUNT(DISTINCT pt.product_id) as product_count
      FROM tags t
      LEFT JOIN product_tags pt ON t.id = pt.tag_id
      WHERE t.type = 'site'
      GROUP BY t.id, t.name
      ORDER BY product_count DESC
    `);

    for (const row of siteTags.rows) {
      console.log(`\n🏷️  ${row.tag_name}: ${row.product_count} products`);
    }

    console.log('\n========================================');
    console.log('CHECK COMPLETE');
    console.log('========================================\n');

  } catch (error) {
    console.error('Error checking collection status:', error);
    throw error;
  }
}

checkCollectionStatus()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
