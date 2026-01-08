-- pgvector拡張を有効化（セマンティック検索用）
-- 注意: Cloud SQL PostgreSQLではpgvector拡張が利用可能（Cloud SQL >= 14）

-- 1. pgvector拡張を有効化
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. 商品のembeddingカラムを追加（OpenAI text-embedding-3-small: 1536次元）
ALTER TABLE products
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- 3. embedding生成元テキストのハッシュ（再計算判定用）
ALTER TABLE products
ADD COLUMN IF NOT EXISTS embedding_text_hash varchar(64);

-- 4. embedding更新日時
ALTER TABLE products
ADD COLUMN IF NOT EXISTS embedding_updated_at timestamp;

-- 5. IVFFlat インデックスを作成（コサイン類似度用）
-- lists パラメータは sqrt(総レコード数) が推奨
-- 約50万商品の場合: sqrt(500000) ≈ 707 → lists = 500 で設定
-- 注意: インデックス作成前に十分なデータが必要（最低でもlists * 10レコード）
-- 最初はインデックスなしで動作し、データが揃ってから作成する

-- 初回は小さいインデックスで作成（後で再構築可能）
-- CREATE INDEX IF NOT EXISTS idx_products_embedding
--   ON products USING ivfflat (embedding vector_cosine_ops)
--   WITH (lists = 100);

-- 6. 女優のembeddingカラムを追加
ALTER TABLE performers
ADD COLUMN IF NOT EXISTS embedding vector(1536);

ALTER TABLE performers
ADD COLUMN IF NOT EXISTS embedding_text_hash varchar(64);

ALTER TABLE performers
ADD COLUMN IF NOT EXISTS embedding_updated_at timestamp;

-- 7. コメント
COMMENT ON COLUMN products.embedding IS 'OpenAI text-embedding-3-small vector (1536 dimensions) for semantic search';
COMMENT ON COLUMN products.embedding_text_hash IS 'SHA256 hash of source text for change detection';
COMMENT ON COLUMN products.embedding_updated_at IS 'Last embedding generation timestamp';
COMMENT ON COLUMN performers.embedding IS 'OpenAI text-embedding-3-small vector (1536 dimensions) for semantic search';

-- 8. embedding未生成の商品を効率的に検索するためのインデックス
CREATE INDEX IF NOT EXISTS idx_products_embedding_null
  ON products (id)
  WHERE embedding IS NULL;

CREATE INDEX IF NOT EXISTS idx_performers_embedding_null
  ON performers (id)
  WHERE embedding IS NULL;
