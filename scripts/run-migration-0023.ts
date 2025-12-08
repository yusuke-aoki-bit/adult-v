/**
 * Migration script to add unique constraint on product_images (product_id, image_url)
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

    const sqlPath = path.join(__dirname, '../drizzle/migrations/0023_add_product_images_unique_constraint.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Executing migration...');
    console.log(sql);

    await client.query(sql);
    console.log('Migration completed successfully!');

    // Verify index was added
    const result = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'product_images' AND indexname = 'idx_product_images_unique'
    `);
    console.log('\nUnique index on product_images:', result.rows);

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
