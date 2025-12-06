import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

async function applyMigration() {
  try {
    console.log('Applying push subscriptions migration...');

    const migrationPath = path.join(
      __dirname,
      '..',
      'drizzle',
      'migrations',
      '0008_add_push_subscriptions.sql'
    );

    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    const db = getDb();
    await db.execute(sql.raw(migrationSQL));

    console.log('✅ Migration applied successfully!');

    // Verify table was created
    const result = await db.execute(sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'push_subscriptions'
    `);

    if (result.rows.length > 0) {
      console.log('✅ push_subscriptions table verified');
    } else {
      console.log('⚠️ Warning: push_subscriptions table not found');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error applying migration:', error);
    process.exit(1);
  }
}

applyMigration();
