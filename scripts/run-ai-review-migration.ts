/**
 * AIレビュー翻訳カラム追加マイグレーション
 */

import { config } from 'dotenv';
import { Pool } from 'pg';
import * as fs from 'fs';

// .env.local を優先して読み込む
config({ path: '.env.local' });
config({ path: '.env' });

const sql = fs.readFileSync('drizzle/migrations/0029_add_ai_review_translations.sql', 'utf8');

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('ERROR: DATABASE_URL is not set');
    process.exit(1);
  }

  console.log('DATABASE_URL is set');

  const pool = new Pool({
    connectionString,
    ssl: false,
  });

  try {
    console.log('🔄 Running AI review translation columns migration...');
    await pool.query(sql);
    console.log('✅ Migration completed successfully');

    // カラムが追加されたか確認
    const result = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'products'
        AND column_name LIKE 'ai_review_%'
      ORDER BY column_name
    `);
    console.log('Columns in products table:', result.rows.map(r => r.column_name));

    const result2 = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'performers'
        AND column_name LIKE 'ai_review_%'
      ORDER BY column_name
    `);
    console.log('Columns in performers table:', result2.rows.map(r => r.column_name));
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
