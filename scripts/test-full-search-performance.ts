/**
 * Test full search performance including related data fetching
 */

import { getDb } from '../lib/db';
import { products, productSources, performers, productPerformers, tags, productTags } from '../lib/db/schema';
import { sql, and, or, desc, eq, inArray } from 'drizzle-orm';

async function testFullSearch() {
  const db = getDb();

  console.log('=== Full Search Performance Test ===\n');

  const query = '女優';

  // Test 1: Just products query
  console.log('Step 1: Fetch products only');
  const start1 = Date.now();

  const productResults = await db
    .select()
    .from(products)
    .where(
      and(
        sql`NOT EXISTS (
          SELECT 1 FROM ${productSources} ps
          WHERE ps.product_id = ${products.id}
          AND ps.asp_name = 'DTI'
        )`,
        or(
          sql`${products.title} ILIKE ${'%' + query + '%'}`,
          sql`${products.description} ILIKE ${'%' + query + '%'}`,
          sql`similarity(${products.title}, ${query}) > 0.2`,
          sql`similarity(${products.description}, ${query}) > 0.15`
        )!
      )
    )
    .orderBy(desc(products.releaseDate), desc(products.createdAt))
    .limit(50);

  const elapsed1 = Date.now() - start1;
  console.log(`  Products: ${productResults.length}`);
  console.log(`  Time: ${elapsed1}ms\n`);

  // Test 2: Fetch related performers
  console.log('Step 2: Fetch related performers');
  const start2 = Date.now();
  const productIds = productResults.map(p => p.id);

  const allPerformers = await db
    .select({
      productId: productPerformers.productId,
      id: performers.id,
      name: performers.name,
      nameKana: performers.nameKana,
    })
    .from(productPerformers)
    .innerJoin(performers, eq(productPerformers.performerId, performers.id))
    .where(inArray(productPerformers.productId, productIds));

  const elapsed2 = Date.now() - start2;
  console.log(`  Performers: ${allPerformers.length}`);
  console.log(`  Time: ${elapsed2}ms\n`);

  // Test 3: Fetch related tags
  console.log('Step 3: Fetch related tags');
  const start3 = Date.now();

  const allTags = await db
    .select({
      productId: productTags.productId,
      id: tags.id,
      name: tags.name,
      category: tags.category,
    })
    .from(productTags)
    .innerJoin(tags, eq(productTags.tagId, tags.id))
    .where(inArray(productTags.productId, productIds));

  const elapsed3 = Date.now() - start3;
  console.log(`  Tags: ${allTags.length}`);
  console.log(`  Time: ${elapsed3}ms\n`);

  // Test 4: Fetch related sources
  console.log('Step 4: Fetch related sources');
  const start4 = Date.now();

  const allSources = await db
    .select()
    .from(productSources)
    .where(inArray(productSources.productId, productIds));

  const elapsed4 = Date.now() - start4;
  console.log(`  Sources: ${allSources.length}`);
  console.log(`  Time: ${elapsed4}ms\n`);

  const totalTime = elapsed1 + elapsed2 + elapsed3 + elapsed4;
  console.log(`Total time: ${totalTime}ms`);
  console.log('\n=== Breakdown ===');
  console.log(`Products query: ${elapsed1}ms (${((elapsed1/totalTime)*100).toFixed(1)}%)`);
  console.log(`Performers fetch: ${elapsed2}ms (${((elapsed2/totalTime)*100).toFixed(1)}%)`);
  console.log(`Tags fetch: ${elapsed3}ms (${((elapsed3/totalTime)*100).toFixed(1)}%)`);
  console.log(`Sources fetch: ${elapsed4}ms (${((elapsed4/totalTime)*100).toFixed(1)}%)`);
}

testFullSearch().then(() => process.exit(0));
