import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function checkIppondoProductIds() {
  const db = getDb();

  console.log('========================================');
  console.log('一本道 (1pondo) PRODUCT IDS CHECK');
  console.log('========================================\n');

  try {
    // Get product IDs to see what was crawled
    const result = await db.execute(sql`
      SELECT
        product_id,
        crawled_at,
        LENGTH(html_content) as content_length
      FROM raw_html_data
      WHERE source = '一本道'
      ORDER BY crawled_at DESC
      LIMIT 20
    `);

    console.log(`Total records found: ${result.rows.length}\n`);

    for (const row of result.rows) {
      console.log(`Product ID: ${row.product_id}`);
      console.log(`  Crawled: ${row.crawled_at}`);
      console.log(`  Content Length: ${row.content_length} bytes`);
    }

    console.log('\n========================================');
    console.log('CHECK COMPLETE');
    console.log('========================================\n');

  } catch (error) {
    console.error('Error checking product IDs:', error);
    throw error;
  }
}

checkIppondoProductIds()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
