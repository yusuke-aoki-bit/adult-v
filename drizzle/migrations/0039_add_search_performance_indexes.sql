-- 検索パフォーマンス最適化インデックス
-- ILIKE検索を高速化するためのtrigramインデックス

-- pg_trgm拡張が必要（既に有効化されている場合はスキップ）
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ==============================================================
-- PART 1: 女優名検索用trigramインデックス
-- ==============================================================

-- 女優名のILIKE検索最適化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_performers_name_trgm
ON performers USING gin (name gin_trgm_ops);

-- 女優名（カナ）のILIKE検索最適化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_performers_name_kana_trgm
ON performers USING gin (name_kana gin_trgm_ops);

-- ==============================================================
-- PART 2: タグ名検索用trigramインデックス
-- ==============================================================

-- タグ名のILIKE検索最適化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tags_name_trgm
ON tags USING gin (name gin_trgm_ops);

-- ==============================================================
-- PART 3: 品番検索用インデックス
-- ==============================================================

-- 正規化品番のILIKE検索最適化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_normalized_id_trgm
ON products USING gin (normalized_product_id gin_trgm_ops);

-- ソース品番のILIKE検索最適化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sources_original_id_trgm
ON product_sources USING gin (original_product_id gin_trgm_ops);

-- ==============================================================
-- PART 4: セール検索用複合インデックス
-- ==============================================================

-- アクティブセールの効率的な検索用
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_active_source
ON product_sales(product_source_id, is_active, end_at)
WHERE is_active = TRUE;

-- ==============================================================
-- PART 5: 動画・画像EXISTS検索用インデックス
-- ==============================================================

-- 動画存在チェック用（product_idでカバリング）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_videos_product_exists
ON product_videos(product_id);

-- 画像存在チェック用（product_idでカバリング）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_images_product_exists
ON product_images(product_id);

-- ==============================================================
-- PART 6: 統計更新
-- ==============================================================

ANALYZE performers;
ANALYZE tags;
ANALYZE products;
ANALYZE product_sources;
ANALYZE product_sales;
ANALYZE product_videos;
ANALYZE product_images;
