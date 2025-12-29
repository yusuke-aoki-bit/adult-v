-- 商品翻訳テーブル
-- 多言語対応のため、商品のタイトル・説明の翻訳を保存

CREATE TABLE IF NOT EXISTS product_translations (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  language VARCHAR(10) NOT NULL, -- 'en', 'zh', 'zh-TW', 'ko'
  title TEXT,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- ユニーク制約: 1商品につき1言語の翻訳のみ
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_translations_unique
  ON product_translations(product_id, language);

-- 商品IDでの検索用インデックス
CREATE INDEX IF NOT EXISTS idx_product_translations_product_id
  ON product_translations(product_id);

-- 言語でのフィルタリング用インデックス
CREATE INDEX IF NOT EXISTS idx_product_translations_language
  ON product_translations(language);
