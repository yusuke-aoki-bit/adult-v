-- カテゴリー/ジャンル/タグ管理テーブル
-- 商品のカテゴリー、ジャンル、タグを一元管理

-- カテゴリーマスターテーブル
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_categories_name ON categories(name);
CREATE INDEX idx_categories_slug ON categories(slug);

-- 商品とカテゴリーの関連テーブル
CREATE TABLE IF NOT EXISTS product_categories (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(product_id, category_id)
);

CREATE INDEX idx_product_categories_product ON product_categories(product_id);
CREATE INDEX idx_product_categories_category ON product_categories(category_id);

-- コメント
COMMENT ON TABLE categories IS 'カテゴリー/ジャンル/タグのマスターテーブル';
COMMENT ON TABLE product_categories IS '商品とカテゴリーの関連付け';
COMMENT ON COLUMN categories.name IS 'カテゴリー名（UNIQUE制約）';
COMMENT ON COLUMN categories.slug IS 'URL用スラッグ';
