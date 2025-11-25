/**
 * Run table rename migration from archived to uncensored
 */
import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const db = getDb();

  console.log('🔧 Running table rename migration (archived -> uncensored)...\n');

  // Read SQL file
  const sqlFilePath = path.join(__dirname, 'migrations', '007_rename_archived_to_uncensored.sql');
  const migrationSql = fs.readFileSync(sqlFilePath, 'utf-8');

  // Execute migration
  try {
    console.log('Executing migration SQL...');
    await db.execute(sql.raw(migrationSql));
    console.log('✅ Migration executed successfully\n');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    throw error;
  }

  // Verify tables were renamed
  console.log('\n📊 Verifying tables...');

  const tables = await db.execute(sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_name IN ('uncensored_products', 'uncensored_product_sources', 'uncensored_product_performers')
      AND table_schema = 'public'
  `);

  console.log(`Found ${tables.rows.length} uncensored tables:`);
  tables.rows.forEach((row: any) => console.log(`  - ${row.table_name}`));

  console.log('\n✅ Migration completed successfully!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
