/**
 * Check for any remaining DTI sites in active products
 */

import { getDb } from '../lib/db';
import { productSources } from '../lib/db/schema';
import { inArray, sql } from 'drizzle-orm';

async function main() {
  const db = getDb();

  const dtiSites = [
    '一本道',
    'カリビアンコム',
    'カリビアンコムプレミアム',
    'HEYZO',
    '天然むすめ',
    'パコパコママ',
    '人妻斬り',
    'エッチな0930',
    'エッチな4610',
  ];

  console.log('🔍 Checking for DTI sites in active products...\n');

  const results = await db
    .select({
      aspName: productSources.aspName,
      count: sql<number>`COUNT(*)`,
    })
    .from(productSources)
    .where(inArray(productSources.aspName, dtiSites))
    .groupBy(productSources.aspName)
    .orderBy(productSources.aspName);

  if (results.length === 0) {
    console.log('✅ No DTI sites found in active products!\n');
  } else {
    console.log('⚠️  Found DTI sites in active products:\n');
    for (const row of results) {
      console.log(`  ${row.aspName}: ${row.count} products`);
    }
    console.log('');
  }

  // Check DTI products count
  const dtiCount = await db.execute(sql`
    SELECT COUNT(*) as count FROM product_sources WHERE asp_name = 'DTI'
  `);

  console.log(`📦 DTI products: ${dtiCount.rows[0].count}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
