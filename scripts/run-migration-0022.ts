/**
 * マイグレーション 0022: 商品AIレビューカラム追加
 */

import { db } from '../lib/db/index.js';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('=== マイグレーション 0022 実行 ===\n');

  // ai_review カラムを追加
  console.log('1. ai_review カラム追加...');
  try {
    await db.execute(sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS ai_review text`);
    console.log('   ✓ 完了');
  } catch (e: any) {
    console.log('   結果:', e.message);
  }

  console.log('2. ai_review_updated_at カラム追加...');
  try {
    await db.execute(sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS ai_review_updated_at timestamp`);
    console.log('   ✓ 完了');
  } catch (e: any) {
    console.log('   結果:', e.message);
  }

  // インデックス作成
  console.log('3. インデックス作成...');
  try {
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_products_ai_review_updated ON products (ai_review_updated_at)`);
    console.log('   ✓ 完了');
  } catch (e: any) {
    console.log('   結果:', e.message);
  }

  // 確認
  console.log('\n4. カラム確認...');
  const result = await db.execute(sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'products' AND column_name LIKE 'ai_review%'
    ORDER BY column_name
  `);
  console.log('   カラム:', result.rows);

  console.log('\n=== マイグレーション完了 ===');
  process.exit(0);
}

main().catch(e => {
  console.error('エラー:', e);
  process.exit(1);
});
