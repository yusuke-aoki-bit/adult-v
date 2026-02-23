import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

async function applyMigration() {
  const db = getDb();

  console.log('Applying product views migration...');

  try {
    // Execute full migration as a single transaction
    const migrationPath = path.join(process.cwd(), 'drizzle', 'migrations', '0007_add_product_views.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log('Executing migration...');

    try {
      await db.execute(sql.raw(migrationSQL));
      console.log('✓ Migration completed');
    } catch (error: any) {
      // Ignore "already exists" errors
      if (error.message?.includes('already exists')) {
        console.log('⊗ Tables already exist');
      } else {
        throw error;
      }
    }

    console.log('\n✅ Migration completed successfully!');

    // Verify tables were created
    console.log('\nVerifying tables...');
    const tables = await db.execute(sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('product_views', 'performer_views')
      ORDER BY table_name
    `);

    console.log('Created tables:', tables.rows);
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

applyMigration()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
