-- フルテキスト検索用のインデックスを追加

-- 1. performersテーブルに検索用のGINインデックスを追加
CREATE INDEX IF NOT EXISTS idx_performers_name_gin
ON performers USING gin(to_tsvector('simple', name));

CREATE INDEX IF NOT EXISTS idx_performers_name_kana_gin
ON performers USING gin(to_tsvector('simple', COALESCE(name_kana, '')));

-- 2. performer_aliasesテーブルに検索用のGINインデックスを追加
CREATE INDEX IF NOT EXISTS idx_performer_aliases_alias_name_gin
ON performer_aliases USING gin(to_tsvector('simple', alias_name));

-- 3. productsテーブルに検索用のGINインデックスを追加
CREATE INDEX IF NOT EXISTS idx_products_title_gin
ON products USING gin(to_tsvector('japanese', title));

CREATE INDEX IF NOT EXISTS idx_products_description_gin
ON products USING gin(to_tsvector('japanese', COALESCE(description, '')));

-- 4. 頭文字検索用のB-treeインデックス（ILIKE 'X%'用）
CREATE INDEX IF NOT EXISTS idx_performers_name_text_pattern
ON performers(name text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_performers_name_kana_text_pattern
ON performers(name_kana text_pattern_ops);

-- 5. 複合インデックス（よく使われるフィルター組み合わせ）
CREATE INDEX IF NOT EXISTS idx_product_performers_composite
ON product_performers(performer_id, product_id);

CREATE INDEX IF NOT EXISTS idx_product_tags_composite
ON product_tags(tag_id, product_id);

CREATE INDEX IF NOT EXISTS idx_product_sources_asp_product
ON product_sources(asp_name, product_id);

CREATE INDEX IF NOT EXISTS idx_product_sources_price
ON product_sources(price) WHERE price IS NOT NULL;

-- 6. 部分インデックス（NULLを除外して効率化）
CREATE INDEX IF NOT EXISTS idx_performers_with_kana
ON performers(name_kana) WHERE name_kana IS NOT NULL;

-- 7. カバリングインデックス（よく使われるカラムを含む）
CREATE INDEX IF NOT EXISTS idx_performers_name_id
ON performers(name, id);

-- 統計情報を更新
ANALYZE performers;
ANALYZE performer_aliases;
ANALYZE products;
ANALYZE product_performers;
ANALYZE product_tags;
ANALYZE product_sources;
