-- product_sourcesテーブルにproduct_typeカラムを追加
-- MGSの配信タイプを区別するため: 'haishin'(配信), 'dvd', 'monthly'(月額)

ALTER TABLE product_sources
ADD COLUMN IF NOT EXISTS product_type VARCHAR(20);

-- インデックスを追加
CREATE INDEX IF NOT EXISTS idx_sources_product_type ON product_sources(product_type);
CREATE INDEX IF NOT EXISTS idx_sources_asp_product_type ON product_sources(asp_name, product_type);
