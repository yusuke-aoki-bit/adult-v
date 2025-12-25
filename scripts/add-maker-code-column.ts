/**
 * マイグレーション: products テーブルに maker_product_code カラムを追加し、
 * normalized_product_id から値を抽出して設定する
 *
 * 実行方法:
 *   npx tsx scripts/add-maker-code-column.ts
 *
 * 本番環境:
 *   DATABASE_URL=<本番DB URL> npx tsx scripts/add-maker-code-column.ts
 */
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://adult-v:AdultV2024!Secure@localhost:5433/postgres',
});
const db = drizzle(pool);

async function migrate() {
  try {
    // 1. カラム追加
    console.log('Adding maker_product_code column...');
    await db.execute(sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS maker_product_code VARCHAR(50)`);
    console.log('Column added successfully');

    // 2. インデックス作成
    console.log('Creating index...');
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_products_maker_code ON products(maker_product_code)`);
    console.log('Index created successfully');

    // 3. normalized_product_id から maker_product_code を設定
    // normalized_product_id がそのまま品番として使える形式になっている
    console.log('Populating maker_product_code from normalized_product_id...');
    const result = await db.execute(sql`
      UPDATE products
      SET maker_product_code = normalized_product_id
      WHERE maker_product_code IS NULL
    `);
    console.log(`Updated ${result.rowCount} rows`);

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Error:', error);
  }
  await pool.end();
  process.exit(0);
}

migrate();
