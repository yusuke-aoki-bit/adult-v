/**
 * Migration script to add unique constraint on product_videos (product_id, video_url)
 * and delete existing duplicates
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

    const sqlPath = path.join(__dirname, '../drizzle/migrations/0024_add_product_videos_unique_constraint.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Executing migration...');
    console.log(sql);

    // Execute each statement separately
    const statements = sql.split(';').filter(s => s.trim());
    for (const statement of statements) {
      if (statement.trim()) {
        console.log('\nExecuting:', statement.trim().substring(0, 100) + '...');
        await client.query(statement);
        console.log('Done');
      }
    }

    console.log('\nMigration completed successfully!');

    // Verify
    const countResult = await client.query('SELECT COUNT(*) as count FROM product_videos');
    console.log('\nFinal video count:', countResult.rows[0].count);

    // Check duplicates
    const dupResult = await client.query(`
      SELECT COUNT(*) as count FROM (
        SELECT product_id, video_url
        FROM product_videos
        GROUP BY product_id, video_url
        HAVING COUNT(*) > 1
      ) t
    `);
    console.log('Remaining duplicates:', dupResult.rows[0].count);

    // Verify index was added
    const indexResult = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'product_videos' AND indexname = 'idx_product_videos_unique'
    `);
    console.log('\nUnique index:', indexResult.rows);

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
