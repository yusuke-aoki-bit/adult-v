/**
 * Check data crawled today by Cloud Scheduler Jobs
 */

import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function checkTodayCrawledData() {
  const db = getDb();

  console.log('========================================');
  console.log('TODAY\'S CRAWLED DATA CHECK');
  console.log('========================================\n');

  try {
    // Check raw_html_data crawled today
    console.log('1. RAW HTML DATA (Crawled Today)');
    console.log('----------------------------------------');

    const htmlToday = await db.execute(sql`
      SELECT
        source,
        COUNT(*) as records_today,
        COUNT(DISTINCT hash) as unique_hashes,
        MIN(crawled_at) as first_crawl,
        MAX(crawled_at) as last_crawl
      FROM raw_html_data
      WHERE DATE(crawled_at) = CURRENT_DATE
      GROUP BY source
      ORDER BY records_today DESC
    `);

    if (htmlToday.rows.length === 0) {
      console.log('❌ No HTML data crawled today');
    } else {
      let totalToday = 0;
      for (const row of htmlToday.rows) {
        console.log(`\n📄 Source: ${row.source}`);
        console.log(`   Records Today: ${row.records_today}`);
        console.log(`   Unique Hashes: ${row.unique_hashes}`);
        console.log(`   First Crawl: ${row.first_crawl}`);
        console.log(`   Last Crawl: ${row.last_crawl}`);
        totalToday += parseInt(row.records_today);
      }
      console.log(`\n✓ Total Records Crawled Today: ${totalToday}`);
    }

    // Check raw_csv_data downloaded today
    console.log('\n\n2. RAW CSV DATA (Downloaded Today)');
    console.log('----------------------------------------');

    const csvToday = await db.execute(sql`
      SELECT
        source,
        COUNT(*) as records_today,
        COUNT(DISTINCT hash) as unique_hashes,
        MIN(downloaded_at) as first_download,
        MAX(downloaded_at) as last_download
      FROM raw_csv_data
      WHERE DATE(downloaded_at) = CURRENT_DATE
      GROUP BY source
      ORDER BY records_today DESC
    `);

    if (csvToday.rows.length === 0) {
      console.log('❌ No CSV data downloaded today');
    } else {
      let totalToday = 0;
      for (const row of csvToday.rows) {
        console.log(`\n📄 Source: ${row.source}`);
        console.log(`   Records Today: ${row.records_today}`);
        console.log(`   Unique Hashes: ${row.unique_hashes}`);
        console.log(`   First Download: ${row.first_download}`);
        console.log(`   Last Download: ${row.last_download}`);
        totalToday += parseInt(row.records_today);
      }
      console.log(`\n✓ Total Records Downloaded Today: ${totalToday}`);
    }

    console.log('\n========================================');
    console.log('CHECK COMPLETE');
    console.log('========================================\n');

  } catch (error) {
    console.error('Error checking today\'s crawled data:', error);
    throw error;
  }
}

checkTodayCrawledData()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
