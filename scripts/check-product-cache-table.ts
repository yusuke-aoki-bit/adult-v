import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function checkProductCacheTable() {
  const db = getDb();

  try {
    const result = await db.execute(
      sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'product_cache'`
    );

    console.log('Product Cache Table Check:');
    console.log(JSON.stringify(result.rows, null, 2));

    if (result.rows.length > 0) {
      console.log('\n⚠️ product_cache table EXISTS in database');
      console.log('This table definition was removed from schema.ts but still exists in the database.');
      console.log('This is causing the Drizzle ORM error.');
    } else {
      console.log('\n✓ product_cache table does NOT exist in database');
    }
  } catch (error) {
    console.error('Error:', error);
  }

  process.exit(0);
}

checkProductCacheTable();
