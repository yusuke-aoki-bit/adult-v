import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function checkPatterns() {
  const db = getDb();

  console.log('=== MGS Product Patterns (without images) ===\n');

  const result = await db.execute(sql`
    SELECT
      SUBSTRING(ps.original_product_id FROM '^([A-Z0-9]+)') as pattern,
      COUNT(*) as count
    FROM product_sources ps
    LEFT JOIN products p ON ps.product_id = p.id
    WHERE ps.asp_name = 'MGS'
    AND (p.default_thumbnail_url IS NULL OR p.default_thumbnail_url = '')
    GROUP BY pattern
    ORDER BY count DESC
    LIMIT 20
  `);

  console.log('Pattern\t\tCount');
  console.log('─'.repeat(40));
  for (const row of result.rows) {
    const r = row as any;
    console.log(`${r.pattern}\t\t${r.count}`);
  }

  // Get sample product IDs for top patterns
  console.log('\n=== Sample Product IDs ===\n');

  const samples = await db.execute(sql`
    SELECT ps.original_product_id
    FROM product_sources ps
    LEFT JOIN products p ON ps.product_id = p.id
    WHERE ps.asp_name = 'MGS'
    AND (p.default_thumbnail_url IS NULL OR p.default_thumbnail_url = '')
    AND ps.original_product_id LIKE '300M%'
    LIMIT 5
  `);

  console.log('300M pattern samples:');
  for (const row of samples.rows) {
    console.log(`  - ${(row as any).original_product_id}`);
  }

  const siroSamples = await db.execute(sql`
    SELECT ps.original_product_id
    FROM product_sources ps
    LEFT JOIN products p ON ps.product_id = p.id
    WHERE ps.asp_name = 'MGS'
    AND (p.default_thumbnail_url IS NULL OR p.default_thumbnail_url = '')
    AND ps.original_product_id LIKE 'SIRO%'
    LIMIT 5
  `);

  console.log('\nSIRO pattern samples:');
  for (const row of siroSamples.rows) {
    console.log(`  - ${(row as any).original_product_id}`);
  }
}

checkPatterns().then(() => process.exit(0));
