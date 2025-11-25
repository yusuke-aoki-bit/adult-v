/**
 * Test search hit rate - compare different search methods
 */

import { getDb } from '../lib/db';
import { products, productSources } from '../lib/db/schema';
import { sql, and, or, desc, like } from 'drizzle-orm';

async function testSearchHitRate() {
  const db = getDb();

  console.log('=== Search Hit Rate Analysis ===\n');

  // Test different search queries
  const testQueries = [
    '素人',
    '人妻',
    'STARS',
    'ABP',
    '中出し',
    '美少女',
    '巨乳',
  ];

  for (const query of testQueries) {
    console.log(`\n📝 Query: "${query}"`);
    console.log('─'.repeat(50));

    // Method 1: Current implementation (ILIKE + similarity)
    const results1 = await db
      .select({ id: products.id, title: products.title })
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
      .limit(10);

    console.log(`  Current method: ${results1.length} hits`);
    if (results1.length > 0) {
      console.log(`  Sample: ${results1[0].title.substring(0, 60)}...`);
    }

    // Method 2: Only ILIKE (no similarity)
    const results2 = await db
      .select({ id: products.id, title: products.title })
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
            sql`${products.description} ILIKE ${'%' + query + '%'}`
          )!
        )
      )
      .limit(10);

    console.log(`  ILIKE only: ${results2.length} hits`);

    // Method 3: Only title ILIKE (most restrictive)
    const results3 = await db
      .select({ id: products.id, title: products.title })
      .from(products)
      .where(
        and(
          sql`NOT EXISTS (
            SELECT 1 FROM ${productSources} ps
            WHERE ps.product_id = ${products.id}
            AND ps.asp_name = 'DTI'
          )`,
          sql`${products.title} ILIKE ${'%' + query + '%'}`
        )
      )
      .limit(10);

    console.log(`  Title ILIKE only: ${results3.length} hits`);

    // Method 4: PostgreSQL full text search (to_tsvector)
    const results4 = await db
      .select({ id: products.id, title: products.title })
      .from(products)
      .where(
        and(
          sql`NOT EXISTS (
            SELECT 1 FROM ${productSources} ps
            WHERE ps.product_id = ${products.id}
            AND ps.asp_name = 'DTI'
          )`,
          sql`(
            to_tsvector('simple', ${products.title}) @@ plainto_tsquery('simple', ${query})
            OR to_tsvector('simple', ${products.description}) @@ plainto_tsquery('simple', ${query})
          )`
        )
      )
      .limit(10);

    console.log(`  Full text search: ${results4.length} hits`);
  }

  console.log('\n\n=== Total Products Count ===');
  const totalCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(products)
    .where(
      sql`NOT EXISTS (
        SELECT 1 FROM ${productSources} ps
        WHERE ps.product_id = ${products.id}
        AND ps.asp_name = 'DTI'
      )`
    );

  console.log(`Total non-DTI products: ${totalCount[0].count}`);
}

testSearchHitRate().then(() => process.exit(0));
