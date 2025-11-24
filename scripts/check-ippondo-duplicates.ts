import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function checkIppondoDuplicates() {
  const db = getDb();

  console.log('========================================');
  console.log('一本道 (1pondo) DUPLICATE CHECK');
  console.log('========================================\n');

  try {
    // Check raw_html_data duplicates
    console.log('1. RAW HTML DATA DUPLICATES');
    console.log('----------------------------------------');

    const duplicates = await db.execute(sql`
      SELECT
        hash,
        COUNT(*) as count,
        array_agg(product_id) as product_ids,
        MIN(crawled_at) as first_crawl,
        MAX(crawled_at) as last_crawl
      FROM raw_html_data
      WHERE source = '一本道'
      GROUP BY hash
      HAVING COUNT(*) > 1
      ORDER BY count DESC
      LIMIT 10
    `);

    if (duplicates.rows.length === 0) {
      console.log('No duplicates found with same hash');
    } else {
      for (const row of duplicates.rows) {
        console.log(`\nHash: ${row.hash}`);
        console.log(`  Count: ${row.count}`);
        console.log(`  Product IDs: ${row.product_ids}`);
        console.log(`  First: ${row.first_crawl}`);
        console.log(`  Last: ${row.last_crawl}`);
      }
    }

    // Check if all records have the same hash
    console.log('\n\n2. HASH DISTRIBUTION');
    console.log('----------------------------------------');

    const hashStats = await db.execute(sql`
      SELECT
        hash,
        COUNT(*) as count
      FROM raw_html_data
      WHERE source = '一本道'
      GROUP BY hash
      ORDER BY count DESC
      LIMIT 5
    `);

    for (const row of hashStats.rows) {
      const shortHash = String(row.hash).substring(0, 20);
      console.log(`\nHash: ${shortHash}...`);
      console.log(`  Records with this hash: ${row.count}`);
    }

    // Sample some product IDs to see the pattern
    console.log('\n\n3. SAMPLE PRODUCT IDS');
    console.log('----------------------------------------');

    const samples = await db.execute(sql`
      SELECT
        product_id,
        hash,
        crawled_at,
        LENGTH(html_content) as content_length
      FROM raw_html_data
      WHERE source = '一本道'
      ORDER BY crawled_at DESC
      LIMIT 10
    `);

    for (const row of samples.rows) {
      const shortHash = String(row.hash).substring(0, 20);
      console.log(`\nProduct ID: ${row.product_id}`);
      console.log(`  Hash: ${shortHash}...`);
      console.log(`  Crawled: ${row.crawled_at}`);
      console.log(`  Content Length: ${row.content_length} bytes`);
    }

    console.log('\n========================================');
    console.log('CHECK COMPLETE');
    console.log('========================================\n');

  } catch (error) {
    console.error('Error checking duplicates:', error);
    throw error;
  }
}

checkIppondoDuplicates()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
