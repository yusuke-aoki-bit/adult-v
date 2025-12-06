/**
 * Create missing database indexes for performance optimization
 */

import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function createIndexes() {
  const db = getDb();

  console.log('Creating missing database indexes...');

  try {
    // 1. product_cache.asp_name index
    console.log('Creating index on product_cache.asp_name...');
    await db.execute(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cache_asp
      ON product_cache USING btree (asp_name);
    `);
    console.log('✓ idx_cache_asp created');

    // 2. product_sources.original_product_id index
    console.log('Creating index on product_sources.original_product_id...');
    await db.execute(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sources_original_product_id
      ON product_sources USING btree (original_product_id);
    `);
    console.log('✓ idx_sources_original_product_id created');

    // 3. product_sources (asp_name, original_product_id) composite index
    console.log('Creating composite index on product_sources...');
    await db.execute(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sources_asp_original_id
      ON product_sources USING btree (asp_name, original_product_id);
    `);
    console.log('✓ idx_sources_asp_original_id created');

    console.log('\n✓ All indexes created successfully!');
  } catch (error) {
    console.error('Error creating indexes:', error);
    throw error;
  }
}

createIndexes()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
