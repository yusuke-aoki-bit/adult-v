/**
 * product_videos テーブルに display_order カラムを追加するマイグレーションスクリプト
 */

import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('=== product_videos テーブル マイグレーション ===\n');

  const db = getDb();

  try {
    // 1. カラムが存在するか確認
    const columnCheck = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'product_videos'
        AND column_name = 'display_order'
    `);

    if (columnCheck.rows.length > 0) {
      console.log('✅ display_order カラムは既に存在します');
    } else {
      console.log('📝 display_order カラムを追加中...');

      await db.execute(sql`
        ALTER TABLE product_videos
        ADD COLUMN display_order INTEGER DEFAULT 0
      `);

      console.log('✅ display_order カラム追加完了');
    }

    // 2. インデックスが存在するか確認
    const indexCheck = await db.execute(sql`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'product_videos'
        AND indexname = 'idx_product_videos_order'
    `);

    if (indexCheck.rows.length > 0) {
      console.log('✅ idx_product_videos_order インデックスは既に存在します');
    } else {
      console.log('📝 インデックスを追加中...');

      await db.execute(sql`
        CREATE INDEX idx_product_videos_order ON product_videos (display_order)
      `);

      console.log('✅ インデックス追加完了');
    }

    // 3. 現在のテーブル構造を確認
    console.log('\n📊 product_videos テーブル構造:');
    const columns = await db.execute(sql`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'product_videos'
      ORDER BY ordinal_position
    `);

    console.table(columns.rows);

    // 4. 現在のデータ件数
    const countResult = await db.execute(sql`
      SELECT COUNT(*) as total FROM product_videos
    `);
    console.log(`\n現在のレコード数: ${countResult.rows[0].total}`);

  } catch (error) {
    console.error('❌ エラー:', error);
    process.exit(1);
  }

  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
