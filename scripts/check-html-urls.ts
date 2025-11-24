/**
 * Check URLs in raw_html_data
 */

import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

const db = getDb();

async function checkUrls() {
  console.log('=== Checking URLs in raw_html_data ===\n');

  const result = await db.execute(sql`
    SELECT source, product_id, url
    FROM raw_html_data
    WHERE source = '一本道'
    ORDER BY id DESC
    LIMIT 20
  `);

  console.log(`Found ${result.rows.length} records:\n`);

  for (const row of result.rows as any[]) {
    console.log(`Product: ${row.product_id}`);
    console.log(`URL: ${row.url}`);
    console.log('---');
  }
}

checkUrls().catch(console.error).finally(() => process.exit(0));
