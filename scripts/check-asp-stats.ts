import { sql } from 'drizzle-orm';
import { getDb } from '../lib/db/index.js';

async function main() {
  const db = getDb();

  console.log('Checking DTI thumbnail_urls for service detection...\n');

  // Check thumbnail_url for DTI
  const thumbSample = await db.execute<{ thumbnail_url: string; affiliate_url: string }>(sql`
    SELECT DISTINCT thumbnail_url, affiliate_url
    FROM product_sources
    WHERE asp_name = 'DTI'
    AND thumbnail_url IS NOT NULL
    LIMIT 20
  `);

  console.log('DTI thumbnail_urls:');
  for (const row of thumbSample.rows || []) {
    console.log(`  thumb: ${row.thumbnail_url?.substring(0, 100)}`);
  }

  // Check if we should use thumbnail_url instead of affiliate_url
  console.log('\n--- Test with thumbnail_url ---');
  const result = await db.execute<{ asp_name: string; product_count: string }>(sql`
    SELECT
      CASE
        WHEN ps.asp_name = 'DTI' THEN
          CASE
            WHEN ps.thumbnail_url LIKE '%caribbeancompr.com%' THEN 'caribbeancompr'
            WHEN ps.thumbnail_url LIKE '%caribbeancom.com%' THEN 'caribbeancom'
            WHEN ps.thumbnail_url LIKE '%1pondo.tv%' THEN '1pondo'
            WHEN ps.thumbnail_url LIKE '%heyzo.com%' THEN 'heyzo'
            WHEN ps.thumbnail_url LIKE '%10musume.com%' THEN '10musume'
            WHEN ps.thumbnail_url LIKE '%pacopacomama.com%' THEN 'pacopacomama'
            WHEN ps.thumbnail_url LIKE '%muramura.tv%' THEN 'muramura'
            WHEN ps.thumbnail_url LIKE '%tokyo-hot.com%' THEN 'tokyohot'
            ELSE 'dti'
          END
        ELSE ps.asp_name
      END as asp_name,
      COUNT(DISTINCT ps.product_id) as product_count
    FROM product_sources ps
    WHERE ps.asp_name IS NOT NULL
    GROUP BY 1
    ORDER BY product_count DESC
  `);

  console.log('\nASP Stats (using thumbnail_url):');
  for (const row of result.rows || []) {
    console.log(`  ${row.asp_name}: ${row.product_count} products`);
  }
}

main().catch(console.error).finally(() => process.exit(0));
