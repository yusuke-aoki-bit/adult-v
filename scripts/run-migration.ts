import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Run database migration from SQL file
 */
async function runMigration() {
  const db = getDb();

  const migrationPath = path.join(process.cwd(), 'drizzle/migrations/0004_add_media_tables.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

  console.log('=== Running Migration: 0004_add_media_tables.sql ===\n');

  try {
    // Execute the migration SQL
    await db.execute(sql.raw(migrationSQL));

    console.log('✅ Migration completed successfully!\n');

    // Verify tables were created
    const tables = await db.execute(sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('performer_images', 'product_images', 'product_videos')
      ORDER BY table_name
    `);

    console.log('📊 New tables created:');
    console.table(tables.rows);

    // Check if new columns were added
    const performersColumns = await db.execute(sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'performers'
      AND column_name = 'profile_image_url'
    `);

    const productsColumns = await db.execute(sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'products'
      AND column_name = 'default_thumbnail_url'
    `);

    console.log('\n📊 New columns added:');
    console.log('performers.profile_image_url:', performersColumns.rows.length > 0 ? '✅' : '❌');
    console.log('products.default_thumbnail_url:', productsColumns.rows.length > 0 ? '✅' : '❌');

  } catch (error) {
    console.error('❌ Migration failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }

  process.exit(0);
}

runMigration().catch(console.error);
