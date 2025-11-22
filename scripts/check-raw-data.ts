/**
 * Check raw data tables
 */

import { getDb } from '../lib/db/index';
import { rawCsvData, rawHtmlData } from '../lib/db/schema';
import { sql } from 'drizzle-orm';

async function checkRawData() {
  try {
    const db = getDb();

    console.log('Checking raw data tables...\n');

    // Check raw_csv_data
    const csvCount = await db.execute(sql`SELECT COUNT(*) FROM raw_csv_data`);
    console.log('raw_csv_data rows:', csvCount.rows[0].count);

    // Check for DUGA entries
    const dugaCount = await db.execute(sql`SELECT COUNT(*) FROM raw_csv_data WHERE source = 'DUGA'`);
    console.log('DUGA entries in raw_csv_data:', dugaCount.rows[0].count);

    // Sample first 5 DUGA entries
    const dugaSample = await db.execute(sql`SELECT source, product_id FROM raw_csv_data WHERE source = 'DUGA' LIMIT 5`);
    console.log('\nFirst 5 DUGA entries:');
    dugaSample.rows.forEach((row: any) => {
      console.log(`  ${row.source} - ${row.product_id}`);
    });

    // Check raw_html_data
    const htmlCount = await db.execute(sql`SELECT COUNT(*) FROM raw_html_data`);
    console.log('\nraw_html_data rows:', htmlCount.rows[0].count);

    console.log('\nDone!');
    process.exit(0);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkRawData();
