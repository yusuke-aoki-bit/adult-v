import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function dropProductCacheTable() {
  const db = getDb();

  try {
    console.log('🗑️  Dropping product_cache table...\n');

    // DROP TABLE
    await db.execute(sql`DROP TABLE IF EXISTS product_cache CASCADE`);

    console.log('✅ product_cache table has been dropped successfully!');
    console.log('This fixes the Drizzle ORM error: Cannot read properties of undefined (reading \'referencedTable\')');
  } catch (error) {
    console.error('❌ Error dropping table:', error);
    process.exit(1);
  }

  process.exit(0);
}

dropProductCacheTable();
