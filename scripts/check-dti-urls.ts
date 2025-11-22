/**
 * Quick check for DTI affiliate URLs
 */

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres';
}

import { getDb } from '../lib/db/index';
import { sql } from 'drizzle-orm';

async function check() {
  const db = getDb();

  console.log('=== DTI Products in product_sources ===');
  const sourceResults = await db.execute(sql`
    SELECT ps.product_id, p.title, ps.affiliate_url
    FROM product_sources ps
    JOIN products p ON ps.product_id = p.id
    WHERE ps.asp_name = 'DTI'
    ORDER BY ps.id DESC
    LIMIT 5
  `);

  for (const row of sourceResults.rows) {
    console.log(`[${row.product_id}] ${row.title}`);
    console.log(`  URL: ${row.affiliate_url}`);
  }

  // Stats
  console.log('\n=== Stats ===');
  const stats = await db.execute(sql`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE affiliate_url LIKE 'https://clear-tv.com/%') as correct_format,
      COUNT(*) FILTER (WHERE affiliate_url NOT LIKE 'https://clear-tv.com/%') as wrong_format
    FROM product_sources
    WHERE asp_name = 'DTI'
  `);
  console.log(`Total: ${stats.rows[0].total}`);
  console.log(`clear-tv.com format: ${stats.rows[0].correct_format}`);
  console.log(`Wrong format: ${stats.rows[0].wrong_format}`);
}

check()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });
