/**
 * Check actual HTML structure in raw_html_data
 */

import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

const db = getDb();

async function checkHtmlSample() {
  console.log('=== Checking HTML samples from raw_html_data ===\n');

  const result = await db.execute(sql`
    SELECT
      source,
      product_id,
      LEFT(html_content, 1500) as html_preview
    FROM raw_html_data
    WHERE source = '一本道'
    LIMIT 3
  `);

  for (const row of result.rows as any[]) {
    console.log(`\n=== ${row.source} - ${row.product_id} ===`);
    console.log(row.html_preview);
    console.log('\n---\n');
  }
}

checkHtmlSample().catch(console.error).finally(() => process.exit(0));
