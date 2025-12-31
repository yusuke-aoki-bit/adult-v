/**
 * マイグレーション実行スクリプト
 *
 * 使い方:
 *   DATABASE_URL="..." npx tsx scripts/run-migration.ts
 */

import { Pool } from 'pg';

// マイグレーションSQL - 完全版
const MIGRATION_SQL = `
-- product_prices テーブル作成 (2024-12-31)
CREATE TABLE IF NOT EXISTS product_prices (
    id SERIAL PRIMARY KEY,
    product_source_id INTEGER NOT NULL REFERENCES product_sources(id) ON DELETE CASCADE,
    price_type VARCHAR(30) NOT NULL,
    price INTEGER NOT NULL,
    currency VARCHAR(3) DEFAULT 'JPY',
    is_default BOOLEAN DEFAULT FALSE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_prices_source_type ON product_prices(product_source_id, price_type);
CREATE INDEX IF NOT EXISTS idx_prices_source ON product_prices(product_source_id);
CREATE INDEX IF NOT EXISTS idx_prices_type ON product_prices(price_type);

-- 追加パフォーマンスインデックス (2024-12)

-- 1. 価格範囲検索用
CREATE INDEX IF NOT EXISTS idx_sources_price_range
ON product_sources(price) WHERE price IS NOT NULL;

-- 2. タグフィルタ高速化
CREATE INDEX IF NOT EXISTS idx_pt_tag_product_covering
ON product_tags(tag_id, product_id);

-- 3. 作品一覧ソート用
CREATE INDEX IF NOT EXISTS idx_products_release_id_desc
ON products(release_date DESC NULLS LAST, id DESC);

-- 4. 女優リストソート用（release_count）
CREATE INDEX IF NOT EXISTS idx_performers_release_count_desc
ON performers(release_count DESC NULLS LAST) WHERE release_count > 0;

-- 5. 女優リストソート用（latest_release）
CREATE INDEX IF NOT EXISTS idx_performers_latest_release_desc
ON performers(latest_release_date DESC NULLS LAST) WHERE latest_release_date IS NOT NULL;

-- 6. product_performers 逆引き
CREATE INDEX IF NOT EXISTS idx_pp_performer_product_release
ON product_performers(performer_id) INCLUDE (product_id);

-- 7. product_sales アクティブセール
CREATE INDEX IF NOT EXISTS idx_sales_active_end_future
ON product_sales(end_at, is_active) WHERE is_active = TRUE;

-- 8. product_rating_summary 評価順
CREATE INDEX IF NOT EXISTS idx_rating_summary_avg_desc
ON product_rating_summary(average_rating DESC NULLS LAST, review_count DESC NULLS LAST)
WHERE review_count > 0;

-- 9. product_reviews 商品別レビュー
CREATE INDEX IF NOT EXISTS idx_reviews_product_created
ON product_reviews(product_id, created_at DESC);

-- 10. product_views 最近の閲覧
CREATE INDEX IF NOT EXISTS idx_views_product_recent
ON product_views(product_id, viewed_at DESC);

-- 11. product_viewers セッション分析
CREATE INDEX IF NOT EXISTS idx_viewers_session_product
ON product_viewers(session_id, product_id, viewed_at DESC);

-- 統計更新
ANALYZE products;
ANALYZE performers;
ANALYZE product_sources;
ANALYZE product_tags;
ANALYZE product_sales;
ANALYZE product_rating_summary;
ANALYZE product_reviews;
ANALYZE product_views;
ANALYZE product_viewers;
`;

/**
 * SQLを個別ステートメントに分割
 * CONCURRENTLYインデックスはトランザクション外で実行する必要があるため
 */
function splitStatements(sql: string): string[] {
  return sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
}

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
    console.log('📄 Adding performance indexes (2024-12)');

    // CONCURRENTLYを含むインデックスは個別実行が必要
    const statements = splitStatements(MIGRATION_SQL);
    let successCount = 0;
    let skipCount = 0;

    for (const stmt of statements) {
      if (!stmt.trim()) continue;

      // CONCURRENTLYを通常のCREATE INDEXに変換（トランザクション内で実行可能に）
      const normalizedStmt = stmt.replace(/CREATE INDEX CONCURRENTLY/gi, 'CREATE INDEX');

      try {
        console.log(`\n📌 Executing: ${normalizedStmt.substring(0, 80)}...`);
        await pool.query(normalizedStmt);
        successCount++;
        console.log('   ✓ Success');
      } catch (err) {
        const error = err as Error;
        // インデックスが既存の場合はスキップ
        if (error.message.includes('already exists')) {
          skipCount++;
          console.log('   ⏭ Skipped (already exists)');
        } else {
          console.error(`   ✗ Failed: ${error.message}`);
        }
      }
    }

    console.log(`\n✅ Migration completed: ${successCount} executed, ${skipCount} skipped`);

    // 確認: インデックス数を表示
    const result = await pool.query(`
      SELECT
        schemaname,
        COUNT(*) as index_count
      FROM pg_indexes
      WHERE schemaname = 'public'
      GROUP BY schemaname
    `);
    console.log('\n📊 Current index count:');
    console.table(result.rows);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
