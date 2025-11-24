import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function runMigration() {
  console.log('🚀 Starting database migration: 0005_add_i18n_columns');

  const db = getDb();
  const migrationPath = path.join(process.cwd(), 'drizzle', 'migrations', '0005_add_i18n_columns.sql');

  try {
    // Read migration file
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    // Split by semicolon and filter out comments and empty lines
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => {
        // Remove empty statements and pure comment blocks
        if (!stmt) return false;
        const lines = stmt.split('\n').filter(line => {
          const trimmed = line.trim();
          return trimmed && !trimmed.startsWith('--');
        });
        return lines.length > 0;
      });

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    let successCount = 0;
    let errorCount = 0;

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      const preview = statement.split('\n')[0].substring(0, 80);

      try {
        console.log(`[${i + 1}/${statements.length}] Executing: ${preview}...`);
        await db.execute(sql.raw(statement));
        successCount++;
        console.log(`  ✅ Success`);
      } catch (error) {
        errorCount++;
        console.error(`  ❌ Error:`, error instanceof Error ? error.message : error);

        // Continue with other statements even if one fails
        // (some might fail if columns already exist, which is ok due to IF NOT EXISTS)
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary:');
    console.log(`  ✅ Successful: ${successCount}`);
    console.log(`  ❌ Failed: ${errorCount}`);
    console.log(`  📝 Total: ${statements.length}`);
    console.log('='.repeat(60));

    if (errorCount === 0) {
      console.log('\n🎉 Migration completed successfully!');
    } else {
      console.log('\n⚠️  Migration completed with some errors. Please review above.');
    }

    // Verify the new columns exist
    console.log('\n🔍 Verifying new columns...');

    const verifyQueries = [
      { table: 'products', columns: ['title_en', 'title_zh', 'title_ko'] },
      { table: 'performers', columns: ['name_en', 'name_zh', 'name_ko'] },
      { table: 'tags', columns: ['name_en', 'name_zh', 'name_ko'] },
    ];

    for (const { table, columns } of verifyQueries) {
      try {
        const result = await db.execute(sql.raw(`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = '${table}'
          AND column_name IN (${columns.map(c => `'${c}'`).join(', ')})
        `));
        console.log(`  ✅ ${table}: Found ${result.rows.length}/${columns.length} columns`);
      } catch (error) {
        console.error(`  ❌ ${table}: Verification failed`);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
