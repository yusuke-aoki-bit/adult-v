/**
 * 検索パフォーマンス改善のためのインデックス作成スクリプト
 */

import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function createIndexes() {
  const db = getDb();

  console.log('🔧 検索パフォーマンス改善のためのインデックスを作成中...\n');

  try {
    // 1. performers テーブル
    console.log('📊 performers テーブルのインデックスを作成中...');
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_performers_name_trgm ON performers USING gin (name gin_trgm_ops)`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_performers_name_kana_trgm ON performers USING gin (name_kana gin_trgm_ops)`,
    );
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_performers_name ON performers (name)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_performers_name_kana ON performers (name_kana)`);
    console.log('✅ performers テーブル完了\n');

    // 2. performer_aliases テーブル
    console.log('📊 performer_aliases テーブルのインデックスを作成中...');
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_performer_aliases_performer_id ON performer_aliases (performer_id)`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_performer_aliases_alias_name_trgm ON performer_aliases USING gin (alias_name gin_trgm_ops)`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_performer_aliases_alias_name ON performer_aliases (alias_name)`,
    );
    console.log('✅ performer_aliases テーブル完了\n');

    // 3. products テーブル
    console.log('📊 products テーブルのインデックスを作成中...');
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_products_release_date ON products (release_date DESC)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_products_created_at ON products (created_at DESC)`);
    console.log('✅ products テーブル完了\n');

    // 4. product_performers テーブル
    console.log('📊 product_performers テーブルのインデックスを作成中...');
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_product_performers_performer_id ON product_performers (performer_id)`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_product_performers_product_id ON product_performers (product_id)`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_product_performers_composite ON product_performers (performer_id, product_id)`,
    );
    console.log('✅ product_performers テーブル完了\n');

    // 5. product_tags テーブル
    console.log('📊 product_tags テーブルのインデックスを作成中...');
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_product_tags_tag_id ON product_tags (tag_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_product_tags_product_id ON product_tags (product_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_product_tags_composite ON product_tags (tag_id, product_id)`);
    console.log('✅ product_tags テーブル完了\n');

    // 6. product_sources テーブル
    console.log('📊 product_sources テーブルのインデックスを作成中...');
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_product_sources_product_id ON product_sources (product_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_product_sources_asp_name ON product_sources (asp_name)`);
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_product_sources_asp_name_product_id ON product_sources (asp_name, product_id)`,
    );
    console.log('✅ product_sources テーブル完了\n');

    console.log('✅ 全てのインデックス作成が完了しました！\n');

    // インデックス使用状況を確認
    console.log('📈 インデックス使用状況:');
    const stats = await db.execute(sql`
      SELECT
        schemaname,
        tablename,
        indexname,
        idx_scan as index_scans
      FROM pg_stat_user_indexes
      WHERE schemaname = 'public'
        AND tablename IN ('performers', 'products', 'product_performers', 'product_tags', 'product_sources', 'performer_aliases')
      ORDER BY idx_scan DESC
      LIMIT 20
    `);

    console.table(stats.rows);
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    throw error;
  }
}

createIndexes()
  .then(() => {
    console.log('\n✅ スクリプト完了');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ スクリプト失敗:', error);
    process.exit(1);
  });
