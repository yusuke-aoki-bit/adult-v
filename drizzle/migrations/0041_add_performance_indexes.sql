-- Performance indexes for query optimization
-- All indexes use CONCURRENTLY for zero-downtime creation

-- 女優フィルターのEXISTS サブクエリ高速化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pp_performer_product
  ON product_performers (performer_id, product_id);

-- セール商品の高速取得（アクティブセールのみ）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_active_discount
  ON product_sales (is_active, discount_percent DESC)
  WHERE is_active = true;

-- 評価ソート高速化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rating_summary_product_avg
  ON product_rating_summary (product_id, average_rating DESC);

-- 商品ソース検索高速化（ASPフィルタ+価格）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sources_product_asp_price
  ON product_sources (product_id, asp_name, price);

-- 商品一覧の頻出ソート（発売日降順）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_release_id
  ON products (release_date DESC NULLS LAST, id DESC);
