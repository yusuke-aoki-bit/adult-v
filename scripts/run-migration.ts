/**
 * マイグレーション実行スクリプト
 *
 * 使い方:
 *   DATABASE_URL="..." npx tsx scripts/run-migration.ts
 */

import { Pool } from 'pg';

const MIGRATION_SQL = `
-- Add translation columns to product_reviews table
ALTER TABLE product_reviews ADD COLUMN IF NOT EXISTS title_en TEXT;
ALTER TABLE product_reviews ADD COLUMN IF NOT EXISTS title_zh TEXT;
ALTER TABLE product_reviews ADD COLUMN IF NOT EXISTS title_ko TEXT;
ALTER TABLE product_reviews ADD COLUMN IF NOT EXISTS content_en TEXT;
ALTER TABLE product_reviews ADD COLUMN IF NOT EXISTS content_zh TEXT;
ALTER TABLE product_reviews ADD COLUMN IF NOT EXISTS content_ko TEXT;

-- Add index for untranslated reviews lookup
CREATE INDEX IF NOT EXISTS idx_product_reviews_untranslated
ON product_reviews (id)
WHERE content_en IS NULL AND content IS NOT NULL;
`;

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('ERROR: DATABASE_URL is not set');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    ssl: false,
  });

  try {
    console.log('🔄 Running migration...');
    await pool.query(MIGRATION_SQL);
    console.log('✅ Migration completed successfully');

    // 確認
    const result = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'product_reviews'
      AND column_name LIKE '%_en' OR column_name LIKE '%_zh' OR column_name LIKE '%_ko'
      ORDER BY column_name
    `);
    console.log('Translation columns:', result.rows.map(r => r.column_name));
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
