/**
 * Analyze the actual SQL query being generated for search
 */

import { getDb } from '../lib/db';
import { products, productSources } from '../lib/db/schema';
import { sql, and, or, desc } from 'drizzle-orm';

async function analyzeQuery() {
  const db = getDb();

  console.log('=== Analyzing Search Query Performance ===\n');

  // Test 1: Simple ILIKE search only
  console.log('Test 1: ILIKE only search');
  const start1 = Date.now();
  const query1 = '女優';

  const results1 = await db
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
          sql`${products.title} ILIKE ${'%' + query1 + '%'}`,
          sql`${products.description} ILIKE ${'%' + query1 + '%'}`
        )!
      )
    )
    .orderBy(desc(products.releaseDate), desc(products.createdAt))
    .limit(50);

  const elapsed1 = Date.now() - start1;
  console.log(`  Results: ${results1.length} products`);
  console.log(`  Time: ${elapsed1}ms\n`);

  // Test 2: ILIKE + similarity (current implementation)
  console.log('Test 2: ILIKE + similarity search');
  const start2 = Date.now();

  const results2 = await db
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
          sql`${products.title} ILIKE ${'%' + query1 + '%'}`,
          sql`${products.description} ILIKE ${'%' + query1 + '%'}`,
          sql`similarity(${products.title}, ${query1}) > 0.2`,
          sql`similarity(${products.description}, ${query1}) > 0.15`
        )!
      )
    )
    .orderBy(desc(products.releaseDate), desc(products.createdAt))
    .limit(50);

  const elapsed2 = Date.now() - start2;
  console.log(`  Results: ${results2.length} products`);
  console.log(`  Time: ${elapsed2}ms\n`);

  // Test 3: Just title ILIKE (most common case)
  console.log('Test 3: Title ILIKE only');
  const start3 = Date.now();

  const results3 = await db
    .select()
    .from(products)
    .where(
      and(
        sql`NOT EXISTS (
          SELECT 1 FROM ${productSources} ps
          WHERE ps.product_id = ${products.id}
          AND ps.asp_name = 'DTI'
        )`,
        sql`${products.title} ILIKE ${'%' + query1 + '%'}`
      )
    )
    .orderBy(desc(products.releaseDate), desc(products.createdAt))
    .limit(50);

  const elapsed3 = Date.now() - start3;
  console.log(`  Results: ${results3.length} products`);
  console.log(`  Time: ${elapsed3}ms\n`);

  console.log('=== Analysis Complete ===');
}

analyzeQuery().then(() => process.exit(0));
