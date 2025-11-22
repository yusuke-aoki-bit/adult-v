/**
 * Database connection test script
 * Run with: npx tsx scripts/test-db.ts
 */

import { getDb } from '../lib/db/index';
import { products, performers } from '../lib/db/schema';

async function testConnection() {
  try {
    console.log('Testing database connection...');

    const db = getDb();

    // Test 1: Count products
    console.log('\n1. Testing products table...');
    const productCount = await db.select().from(products);
    console.log(`   Found ${productCount.length} products`);

    // Test 2: Count performers
    console.log('\n2. Testing performers table...');
    const performerCount = await db.select().from(performers);
    console.log(`   Found ${performerCount.length} performers`);

    console.log('\n✅ Database connection successful!');
  } catch (error) {
    console.error('\n❌ Database connection failed:', error);
    process.exit(1);
  }
}

testConnection();
