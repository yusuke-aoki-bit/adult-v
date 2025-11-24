/**
 * Debug script to investigate why 一本道 filter shows 0 actresses
 */

import { getDb } from '../lib/db';
import { tags, productTags, productPerformers, performers } from '../lib/db/schema';
import { sql, eq, like, inArray } from 'drizzle-orm';

const db = getDb();

async function debugFilter() {
  console.log('=== Debugging 一本道 Filter Issue ===\n');

  // 1. Find the tag
  console.log('1. Finding 一本道 tag...');
  const pondoTags = await db.select().from(tags)
    .where(sql`${tags.name} LIKE '%一本道%' OR ${tags.name} LIKE '%1pondo%'`);

  console.log('Found tags:', pondoTags);
  console.log('');

  if (pondoTags.length === 0) {
    console.log('ERROR: No 一本道 tag found!');
    return;
  }

  const tagId = pondoTags[0].id;
  console.log(`Using tag ID: ${tagId}`);
  console.log('');

  // 2. Count products with this tag
  console.log('2. Counting products with this tag...');
  const productCount = await db.execute(sql`
    SELECT COUNT(DISTINCT product_id) as count
    FROM product_tags
    WHERE tag_id = ${tagId}
  `);
  console.log('Products with tag:', productCount.rows[0]);
  console.log('');

  // 3. Count performers through products
  console.log('3. Counting performers through product_performers...');
  const performerCount = await db.execute(sql`
    SELECT COUNT(DISTINCT pp.performer_id) as count
    FROM product_tags pt
    INNER JOIN product_performers pp ON pt.product_id = pp.product_id
    WHERE pt.tag_id = ${tagId}
  `);
  console.log('Performers with products:', performerCount.rows[0]);
  console.log('');

  // 4. Sample some performers
  console.log('4. Sample performers with 一本道 products...');
  const samplePerformers = await db.execute(sql`
    SELECT DISTINCT p.id, p.name, COUNT(DISTINCT pp.product_id) as product_count
    FROM performers p
    INNER JOIN product_performers pp ON p.id = pp.performer_id
    INNER JOIN product_tags pt ON pp.product_id = pt.product_id
    WHERE pt.tag_id = ${tagId}
    GROUP BY p.id, p.name
    ORDER BY product_count DESC
    LIMIT 10
  `);
  console.log('Sample performers:');
  console.table(samplePerformers.rows);
  console.log('');

  // 5. Check performer_tags table
  console.log('5. Checking if performers have the tag directly...');
  const performerTagsCount = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM performer_tags
    WHERE tag_id = ${tagId}
  `);
  console.log('Performers with tag directly:', performerTagsCount.rows[0]);
  console.log('');

  // 6. Test the query used in getActresses
  console.log('6. Testing getActresses query logic...');
  const testQuery = await db.execute(sql`
    SELECT DISTINCT p.id, p.name
    FROM performers p
    INNER JOIN product_performers pp ON p.id = pp.performer_id
    INNER JOIN product_tags pt ON pp.product_id = pt.product_id
    WHERE pt.tag_id IN (${tagId})
    LIMIT 10
  `);
  console.log('Test query results:');
  console.table(testQuery.rows);
  console.log('');

  console.log('=== Debug Complete ===');
}

debugFilter().catch(console.error).finally(() => process.exit(0));
