/**
 * マイグレーション実行スクリプト
 * Cloud Run Job経由で実行
 *
 * 使い方:
 *   npx tsx packages/crawlers/src/enrichment/run-migration.ts
 */

import { sql } from 'drizzle-orm';
import { getDb, closeDb } from '../lib/db';

async function main() {
  console.log('🔄 マイグレーション開始...');

  const db = getDb();

  try {
    // レビューテーブルに翻訳カラムを追加
    console.log('  Adding translation columns to product_reviews...');

    await db.execute(sql`
      ALTER TABLE product_reviews ADD COLUMN IF NOT EXISTS title_en TEXT
    `);
    await db.execute(sql`
      ALTER TABLE product_reviews ADD COLUMN IF NOT EXISTS title_zh TEXT
    `);
    await db.execute(sql`
      ALTER TABLE product_reviews ADD COLUMN IF NOT EXISTS title_ko TEXT
    `);
    await db.execute(sql`
      ALTER TABLE product_reviews ADD COLUMN IF NOT EXISTS content_en TEXT
    `);
    await db.execute(sql`
      ALTER TABLE product_reviews ADD COLUMN IF NOT EXISTS content_zh TEXT
    `);
    await db.execute(sql`
      ALTER TABLE product_reviews ADD COLUMN IF NOT EXISTS content_ko TEXT
    `);

    console.log('  Creating index for untranslated reviews...');
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_product_reviews_untranslated
      ON product_reviews (id)
      WHERE content_en IS NULL AND content IS NOT NULL
    `);

    // 確認
    const result = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'product_reviews'
      AND (column_name LIKE '%_en' OR column_name LIKE '%_zh' OR column_name LIKE '%_ko')
      ORDER BY column_name
    `);

    console.log('✅ マイグレーション完了');
    console.log(
      '  Translation columns:',
      (result.rows as Array<{ column_name: string }>).map((r) => r.column_name),
    );
  } finally {
    await closeDb();
  }
}

main().catch((e) => {
  console.error('❌ エラー:', e);
  process.exit(1);
});
