/**
 * Run archive tables migration
 */
import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const db = getDb();

  console.log('🔧 Running archive tables migration...\n');

  // Read SQL file
  const sqlFilePath = path.join(__dirname, 'migrations', '006_create_archive_tables.sql');
  const migrationSql = fs.readFileSync(sqlFilePath, 'utf-8');

  // Execute entire migration as one transaction
  try {
    console.log('Executing migration SQL...');
    await db.execute(sql.raw(migrationSql));
    console.log('✅ Migration executed successfully\n');
  } catch (error: any) {
    if (error.message?.includes('already exists')) {
      console.log('⚠️  Tables already exist, skipping\n');
    } else {
      console.error('❌ Error:', error.message);
      throw error;
    }
  }

  // Verify tables were created
  console.log('\n📊 Verifying tables...');

  const tables = await db.execute(sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_name IN ('archived_products', 'archived_product_sources')
      AND table_schema = 'public'
  `);

  console.log(`Found ${tables.rows.length} archive tables:`);
  tables.rows.forEach((row: any) => console.log(`  - ${row.table_name}`));

  console.log('\n✅ Migration completed successfully!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
