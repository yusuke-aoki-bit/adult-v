-- Additional composite indexes for common query patterns
-- All indexes use CONCURRENTLY for zero-downtime creation

-- クローラーステータス・レジューム用 (asp_name + last_updated)
-- status.ts, backfill-reviews.ts で asp_name フィルター + last_updated ソートを高速化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_sources_asp_last_updated
  ON product_sources (asp_name, last_updated DESC NULLS LAST);

-- 女優リスト release_count ソート高速化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_performers_release_count
  ON performers (release_count DESC NULLS LAST)
  WHERE release_count > 0;

-- セール商品 + 発売日ソート複合（セール一覧ページ高速化）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_sale_release
  ON products (release_date DESC NULLS LAST, id DESC)
  WHERE has_active_sale = true;

ANALYZE product_sources;
ANALYZE performers;
ANALYZE products;
