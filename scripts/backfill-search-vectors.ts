/**
 * Backfill search_vector for all existing products
 * This will trigger the update function for each product
 */

import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function backfillSearchVectors() {
  const db = getDb();

  console.log('=== Backfilling Search Vectors ===\n');

  try {
    // Get total count
    const countResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM products
    `);
    const totalProducts = Number(countResult.rows[0].count);
    console.log(`Total products: ${totalProducts.toLocaleString()}\n`);

    // Batch update to trigger the function
    // This is more efficient than updating one by one
    console.log('Updating all products to generate search_vector...');
    console.log('(This may take a few minutes for 143K products)\n');

    const startTime = Date.now();

    // Update in batches of 10,000 to avoid timeout
    const batchSize = 10000;
    let offset = 0;

    while (offset < totalProducts) {
      const batchStart = Date.now();

      await db.execute(sql`
        UPDATE products
        SET updated_at = updated_at
        WHERE id IN (
          SELECT id FROM products
          ORDER BY id
          LIMIT ${batchSize}
          OFFSET ${offset}
        )
      `);

      offset += batchSize;
      const progress = Math.min(100, (offset / totalProducts) * 100);
      const elapsed = Date.now() - batchStart;

      console.log(`Progress: ${progress.toFixed(1)}% (${offset.toLocaleString()} / ${totalProducts.toLocaleString()}) - Batch took ${elapsed}ms`);
    }

    const totalTime = Date.now() - startTime;
    console.log(`\n✅ All search vectors generated in ${(totalTime / 1000).toFixed(1)}s\n`);

    // Verify
    console.log('Verifying...');
    const verifyResult = await db.execute(sql`
      SELECT
        COUNT(*) as total,
        COUNT(search_vector) as with_vector,
        COUNT(*) - COUNT(search_vector) as without_vector
      FROM products
    `);

    const stats = verifyResult.rows[0];
    console.log(`Total products: ${stats.total}`);
    console.log(`With search_vector: ${stats.with_vector}`);
    console.log(`Without search_vector: ${stats.without_vector}`);

    if (Number(stats.without_vector) === 0) {
      console.log('\n✅ All products have search_vector!');
    } else {
      console.log(`\n⚠️  ${stats.without_vector} products still missing search_vector`);
    }

    // Show sample
    console.log('\nSample search vectors:');
    const sampleResult = await db.execute(sql`
      SELECT
        id,
        title,
        search_vector::text as vector_preview
      FROM products
      WHERE search_vector IS NOT NULL
      LIMIT 3
    `);

    for (const row of sampleResult.rows) {
      console.log(`\n  Product: ${row.id}`);
      console.log(`  Title: ${row.title.substring(0, 60)}...`);
      console.log(`  Vector: ${row.vector_preview.substring(0, 100)}...`);
    }

  } catch (error) {
    console.error('❌ Backfill failed:', error);
    throw error;
  }
}

backfillSearchVectors().then(() => process.exit(0));
