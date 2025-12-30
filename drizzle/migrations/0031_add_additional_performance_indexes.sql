-- 追加パフォーマンスインデックス (2024-12)
-- 既存の0026インデックスを補完

-- ==============================================================
-- PART 1: 検索・フィルタリング用インデックス
-- ==============================================================

-- 1. product_sources の価格範囲検索用（BETWEEN/範囲クエリ最適化）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sources_price_range
ON product_sources(price) WHERE price IS NOT NULL;

-- 2. product_tags の複合インデックス（タグフィルタ高速化）
-- EXISTS (SELECT 1 FROM product_tags WHERE product_id = ? AND tag_id IN (...))
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pt_tag_product_covering
ON product_tags(tag_id, product_id);

-- 3. products の複合ソート用インデックス（作品一覧ページ）
-- ORDER BY release_date DESC, id DESC が多用されている
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_release_id_desc
ON products(release_date DESC NULLS LAST, id DESC);

-- 4. performers の事前計算カラムソート用
-- getActresses で release_count, latest_release_date でソート
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_performers_release_count_desc
ON performers(release_count DESC NULLS LAST) WHERE release_count > 0;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_performers_latest_release_desc
ON performers(latest_release_date DESC NULLS LAST) WHERE latest_release_date IS NOT NULL;

-- ==============================================================
-- PART 2: JOIN 最適化インデックス
-- ==============================================================

-- 5. product_performers の逆引き（performer_id -> product_ids）
-- 女優詳細ページで作品一覧取得時に使用
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pp_performer_product_release
ON product_performers(performer_id)
INCLUDE (product_id);

-- 6. product_sales のアクティブセール検索最適化
-- end_at > NOW() AND is_active = true のクエリ用
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_active_end_future
ON product_sales(end_at, is_active)
WHERE is_active = TRUE AND end_at > NOW();

-- ==============================================================
-- PART 3: レビュー・評価関連インデックス
-- ==============================================================

-- 7. product_rating_summary の高評価フィルタ用
-- 評価順ソートで使用
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rating_summary_avg_desc
ON product_rating_summary(average_rating DESC NULLS LAST, review_count DESC NULLS LAST)
WHERE review_count > 0;

-- 8. product_reviews の商品別レビュー取得最適化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reviews_product_created
ON product_reviews(product_id, created_at DESC);

-- ==============================================================
-- PART 4: 閲覧履歴・分析用インデックス
-- ==============================================================

-- 9. product_views の最近の閲覧取得用
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_views_product_recent
ON product_views(product_id, viewed_at DESC);

-- 10. product_viewers のセッション分析用
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_viewers_session_product
ON product_viewers(session_id, product_id, viewed_at DESC);

-- ==============================================================
-- PART 5: 統計更新
-- ==============================================================

ANALYZE products;
ANALYZE performers;
ANALYZE product_sources;
ANALYZE product_performers;
ANALYZE product_tags;
ANALYZE product_sales;
ANALYZE product_rating_summary;
ANALYZE product_reviews;
ANALYZE product_views;
ANALYZE product_viewers;
