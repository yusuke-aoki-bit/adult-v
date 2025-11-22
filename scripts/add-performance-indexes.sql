-- パフォーマンス最適化のための追加インデックス

-- product_performersテーブルのインデックス（N+1解消用バッチクエリ対応）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pp_product_performer_combo
ON product_performers(product_id, performer_id);

-- product_tagsテーブルのインデックス（N+1解消用バッチクエリ対応）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pt_product_tag_combo
ON product_tags(product_id, tag_id);

-- product_sourcesテーブルの複合インデックス
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sources_product_price
ON product_sources(product_id, price);

-- product_cacheテーブルの複合インデックス
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cache_product_price
ON product_cache(product_id, price);

-- productsテーブルのソート用複合インデックス
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_release_created
ON products(release_date DESC NULLS LAST, created_at DESC);

-- performersテーブルの作成日用インデックス（新着順用）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_performers_created
ON performers(created_at DESC);

-- product_performersの女優別カウント高速化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pp_performer_only
ON product_performers(performer_id);

-- ANALYZE実行
ANALYZE products;
ANALYZE performers;
ANALYZE product_performers;
ANALYZE product_tags;
ANALYZE product_sources;
ANALYZE product_cache;
ANALYZE tags;
