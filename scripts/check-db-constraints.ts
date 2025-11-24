import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function checkConstraints() {
  const db = getDb();

  try {
    console.log('🔍 Checking for product_cache related constraints...\n');

    // Check if product_cache table exists
    const tableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'product_cache'
      );
    `);

    console.log('Table exists check:', tableExists.rows[0]);

    // Check all foreign key constraints
    const constraints = await db.execute(sql`
      SELECT
        conname AS constraint_name,
        conrelid::regclass AS table_name,
        confrelid::regclass AS referenced_table,
        pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE contype = 'f'
      AND (
        conrelid::regclass::text LIKE '%product_cache%'
        OR confrelid::regclass::text LIKE '%product_cache%'
      );
    `);

    console.log('\n📋 Foreign key constraints:', JSON.stringify(constraints.rows, null, 2));

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }

  process.exit(0);
}

checkConstraints();
