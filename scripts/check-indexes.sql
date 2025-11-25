-- 検索パフォーマンス改善のためのインデックス確認・作成スクリプト

-- 1. 既存のインデックスを確認
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename IN ('performers', 'products', 'product_performers', 'product_tags', 'product_sources', 'performer_aliases')
ORDER BY tablename, indexname;

-- 2. 必要なインデックスを作成（存在しない場合のみ）

-- performers テーブル
CREATE INDEX IF NOT EXISTS idx_performers_name_trgm ON performers USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_performers_name_kana_trgm ON performers USING gin (name_kana gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_performers_name ON performers (name);
CREATE INDEX IF NOT EXISTS idx_performers_name_kana ON performers (name_kana);

-- performer_aliases テーブル
CREATE INDEX IF NOT EXISTS idx_performer_aliases_performer_id ON performer_aliases (performer_id);
CREATE INDEX IF NOT EXISTS idx_performer_aliases_alias_name_trgm ON performer_aliases USING gin (alias_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_performer_aliases_alias_name ON performer_aliases (alias_name);

-- products テーブル
CREATE INDEX IF NOT EXISTS idx_products_release_date ON products (release_date DESC);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products (created_at DESC);

-- product_performers テーブル
CREATE INDEX IF NOT EXISTS idx_product_performers_performer_id ON product_performers (performer_id);
CREATE INDEX IF NOT EXISTS idx_product_performers_product_id ON product_performers (product_id);
CREATE INDEX IF NOT EXISTS idx_product_performers_composite ON product_performers (performer_id, product_id);

-- product_tags テーブル
CREATE INDEX IF NOT EXISTS idx_product_tags_tag_id ON product_tags (tag_id);
CREATE INDEX IF NOT EXISTS idx_product_tags_product_id ON product_tags (product_id);
CREATE INDEX IF NOT EXISTS idx_product_tags_composite ON product_tags (tag_id, product_id);

-- product_sources テーブル
CREATE INDEX IF NOT EXISTS idx_product_sources_product_id ON product_sources (product_id);
CREATE INDEX IF NOT EXISTS idx_product_sources_asp_name ON product_sources (asp_name);
CREATE INDEX IF NOT EXISTS idx_product_sources_asp_name_product_id ON product_sources (asp_name, product_id);

-- 3. インデックス使用状況を確認
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
    AND tablename IN ('performers', 'products', 'product_performers', 'product_tags', 'product_sources', 'performer_aliases')
ORDER BY idx_scan DESC;

-- 4. テーブルサイズを確認
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) AS indexes_size
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN ('performers', 'products', 'product_performers', 'product_tags', 'product_sources', 'performer_aliases')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
