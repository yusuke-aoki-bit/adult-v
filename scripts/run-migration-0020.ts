/**
 * Migration script to add zh-TW (Traditional Chinese) columns
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

    const sqlPath = path.join(__dirname, '../drizzle/migrations/0020_add_zh_tw_columns.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Executing migration...');
    console.log(sql);

    await client.query(sql);
    console.log('Migration completed successfully!');

    // Verify columns were added
    const result = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'products' AND column_name LIKE '%zh_tw%'
    `);
    console.log('\nAdded columns in products:', result.rows);

    const perfResult = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'performers' AND column_name LIKE '%zh_tw%'
    `);
    console.log('Added columns in performers:', perfResult.rows);

    const tagResult = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'tags' AND column_name LIKE '%zh_tw%'
    `);
    console.log('Added columns in tags:', tagResult.rows);

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
