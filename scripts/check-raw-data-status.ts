/**
 * Check raw data storage status and deduplication capability
 */

import { getDb } from '../lib/db';
import { rawHtmlData, rawCsvData } from '../lib/db/schema';
import { sql } from 'drizzle-orm';

async function checkRawDataStatus() {
  const db = getDb();

  console.log('========================================');
  console.log('RAW DATA STORAGE STATUS CHECK');
  console.log('========================================\n');

  try {
    // Check raw_html_data
    console.log('1. RAW HTML DATA (Crawled Sites)');
    console.log('----------------------------------------');

    const htmlStats = await db.execute(sql`
      SELECT
        source,
        COUNT(*) as total_records,
        COUNT(DISTINCT hash) as unique_hashes,
        COUNT(*) - COUNT(DISTINCT hash) as duplicate_count,
        MIN(crawled_at) as first_crawl,
        MAX(crawled_at) as last_crawl,
        COUNT(CASE WHEN processed_at IS NOT NULL THEN 1 END) as processed_count,
        COUNT(CASE WHEN processed_at IS NULL THEN 1 END) as unprocessed_count
      FROM raw_html_data
      GROUP BY source
      ORDER BY total_records DESC
    `);

    if (htmlStats.rows.length === 0) {
      console.log('❌ No raw HTML data found');
    } else {
      for (const row of htmlStats.rows) {
        console.log(`\n📄 Source: ${row.source}`);
        console.log(`   Total Records: ${row.total_records}`);
        console.log(`   Unique Hashes: ${row.unique_hashes}`);
        console.log(`   Duplicates Prevented: ${row.duplicate_count}`);
        console.log(`   Processed: ${row.processed_count}`);
        console.log(`   Unprocessed: ${row.unprocessed_count}`);
        console.log(`   First Crawl: ${row.first_crawl}`);
        console.log(`   Last Crawl: ${row.last_crawl}`);
      }
    }

    // Check raw_csv_data
    console.log('\n\n2. RAW CSV DATA (Downloaded Files)');
    console.log('----------------------------------------');

    const csvStats = await db.execute(sql`
      SELECT
        source,
        COUNT(*) as total_records,
        COUNT(DISTINCT hash) as unique_hashes,
        COUNT(*) - COUNT(DISTINCT hash) as duplicate_count,
        MIN(downloaded_at) as first_download,
        MAX(downloaded_at) as last_download,
        COUNT(CASE WHEN processed_at IS NOT NULL THEN 1 END) as processed_count,
        COUNT(CASE WHEN processed_at IS NULL THEN 1 END) as unprocessed_count
      FROM raw_csv_data
      GROUP BY source
      ORDER BY total_records DESC
    `);

    if (csvStats.rows.length === 0) {
      console.log('❌ No raw CSV data found');
    } else {
      for (const row of csvStats.rows) {
        console.log(`\n📄 Source: ${row.source}`);
        console.log(`   Total Records: ${row.total_records}`);
        console.log(`   Unique Hashes: ${row.unique_hashes}`);
        console.log(`   Duplicates Prevented: ${row.duplicate_count}`);
        console.log(`   Processed: ${row.processed_count}`);
        console.log(`   Unprocessed: ${row.unprocessed_count}`);
        console.log(`   First Download: ${row.first_download}`);
        console.log(`   Last Download: ${row.last_download}`);
      }
    }

    // Check deduplication indexes
    console.log('\n\n3. DEDUPLICATION CAPABILITY');
    console.log('----------------------------------------');

    const indexes = await db.execute(sql`
      SELECT
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename IN ('raw_html_data', 'raw_csv_data')
        AND (indexname LIKE '%hash%' OR indexname LIKE '%source_product%')
      ORDER BY tablename, indexname
    `);

    if (indexes.rows.length === 0) {
      console.log('❌ No deduplication indexes found');
    } else {
      for (const row of indexes.rows) {
        console.log(`\n✓ Table: ${row.tablename}`);
        console.log(`  Index: ${row.indexname}`);
        console.log(`  Definition: ${row.indexdef}`);
      }
    }

    // Overall summary
    console.log('\n\n4. OVERALL SUMMARY');
    console.log('========================================');

    const totalHtml = htmlStats.rows.reduce((sum: number, row: any) => sum + parseInt(row.total_records), 0);
    const totalCsv = csvStats.rows.reduce((sum: number, row: any) => sum + parseInt(row.total_records), 0);
    const totalDuplicatesHtml = htmlStats.rows.reduce((sum: number, row: any) => sum + parseInt(row.duplicate_count), 0);
    const totalDuplicatesCsv = csvStats.rows.reduce((sum: number, row: any) => sum + parseInt(row.duplicate_count), 0);

    console.log(`\n📊 Total Raw HTML Records: ${totalHtml}`);
    console.log(`📊 Total Raw CSV Records: ${totalCsv}`);
    console.log(`🔒 Total Duplicates Prevented (HTML): ${totalDuplicatesHtml}`);
    console.log(`🔒 Total Duplicates Prevented (CSV): ${totalDuplicatesCsv}`);
    console.log(`\n✓ Deduplication System: ${indexes.rows.length > 0 ? 'ACTIVE' : 'NOT CONFIGURED'}`);
    console.log(`✓ Data Preservation: ${totalHtml + totalCsv > 0 ? 'WORKING' : 'NO DATA YET'}`);

    console.log('\n========================================');
    console.log('CHECK COMPLETE');
    console.log('========================================\n');

  } catch (error) {
    console.error('Error checking raw data status:', error);
    throw error;
  }
}

checkRawDataStatus()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
