/**
 * Migration script to add performer profile columns
 */

import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();
    console.log('Connected to database');

    const sqlPath = path.join(__dirname, '../drizzle/migrations/0021_add_performer_profile_columns.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Executing migration 0021...');
    console.log(sql);

    await client.query(sql);
    console.log('Migration completed successfully!');

    // Verify columns were added
    const result = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'performers' AND column_name IN ('height', 'bust', 'waist', 'hip', 'cup', 'birthday', 'blood_type', 'birthplace', 'hobbies', 'twitter_id', 'instagram_id', 'debut_year', 'is_retired')
      ORDER BY column_name
    `);
    console.log('\nAdded/verified columns in performers:', result.rows);

    // Check if performer_external_ids table was created
    const tableResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'performer_external_ids'
    `);
    console.log('performer_external_ids table exists:', tableResult.rows.length > 0);

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
