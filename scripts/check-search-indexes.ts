/**
 * Check database indexes for search performance
 */

import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function checkIndexes() {
  const db = getDb();

  console.log('=== Checking Database Indexes ===\n');

  // Check indexes on products table
  const productIndexes = await db.execute(sql`
    SELECT
      indexname,
      indexdef
    FROM pg_indexes
    WHERE tablename = 'products'
    ORDER BY indexname
  `);

  console.log('Products table indexes:');
  console.log(JSON.stringify(productIndexes.rows, null, 2));
  console.log('\n');

  // Check indexes on product_sources table
  const productSourcesIndexes = await db.execute(sql`
    SELECT
      indexname,
      indexdef
    FROM pg_indexes
    WHERE tablename = 'product_sources'
    ORDER BY indexname
  `);

  console.log('Product_sources table indexes:');
  console.log(JSON.stringify(productSourcesIndexes.rows, null, 2));
  console.log('\n');

  // Check indexes on product_performers table
  const productPerformersIndexes = await db.execute(sql`
    SELECT
      indexname,
      indexdef
    FROM pg_indexes
    WHERE tablename = 'product_performers'
    ORDER BY indexname
  `);

  console.log('Product_performers table indexes:');
  console.log(JSON.stringify(productPerformersIndexes.rows, null, 2));
  console.log('\n');

  // Check indexes on product_tags table
  const productTagsIndexes = await db.execute(sql`
    SELECT
      indexname,
      indexdef
    FROM pg_indexes
    WHERE tablename = 'product_tags'
    ORDER BY indexname
  `);

  console.log('Product_tags table indexes:');
  console.log(JSON.stringify(productTagsIndexes.rows, null, 2));
  console.log('\n');

  // Check if pg_trgm extension is installed
  const pgTrgmExtension = await db.execute(sql`
    SELECT * FROM pg_extension WHERE extname = 'pg_trgm'
  `);

  console.log('pg_trgm extension installed:', pgTrgmExtension.rows.length > 0 ? 'YES' : 'NO');
  console.log(JSON.stringify(pgTrgmExtension.rows, null, 2));
  console.log('\n');

  // Check table sizes
  const tableSizes = await db.execute(sql`
    SELECT
      schemaname,
      tablename,
      pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
      pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
    FROM pg_tables
    WHERE tablename IN ('products', 'product_sources', 'product_performers', 'product_tags')
    ORDER BY size_bytes DESC
  `);

  console.log('Table sizes:');
  console.log(JSON.stringify(tableSizes.rows, null, 2));
  console.log('\n');
}

checkIndexes().then(() => process.exit(0));
