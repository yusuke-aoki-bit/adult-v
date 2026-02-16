-- Gemini text-embedding-004 移行（768次元）
-- OpenAI text-embedding-3-small (1536次元) から Gemini text-embedding-004 (768次元) へ変更
-- コスト削減: OpenAI API Key不要、既存のGemini API Keyで動作

-- 1. 既存のembeddingカラムを削除して再作成（次元数変更）
-- 注: 既存のembeddingデータはリセットされる（OpenAI Key未設定のため本番データなし）
ALTER TABLE products DROP COLUMN IF EXISTS embedding;
ALTER TABLE products
ADD COLUMN embedding vector(768);

ALTER TABLE performers DROP COLUMN IF EXISTS embedding;
ALTER TABLE performers
ADD COLUMN embedding vector(768);

-- 2. embedding_text_hash と embedding_updated_at をリセット
UPDATE products SET embedding_text_hash = NULL, embedding_updated_at = NULL
WHERE embedding_text_hash IS NOT NULL;

UPDATE performers SET embedding_text_hash = NULL, embedding_updated_at = NULL
WHERE embedding_text_hash IS NOT NULL;

-- 3. インデックス再作成（NULLチェック用）
DROP INDEX IF EXISTS idx_products_embedding_null;
CREATE INDEX idx_products_embedding_null
  ON products (id)
  WHERE embedding IS NULL;

DROP INDEX IF EXISTS idx_performers_embedding_null;
CREATE INDEX idx_performers_embedding_null
  ON performers (id)
  WHERE embedding IS NULL;

-- 4. IVFFlatインデックス（データが十分に蓄積されてから有効化）
-- 768次元は1536次元よりインデックス効率が良い
-- sqrt(100000) ≈ 316 → lists = 200 で設定
-- CREATE INDEX idx_products_embedding_ivfflat
--   ON products USING ivfflat (embedding vector_cosine_ops)
--   WITH (lists = 200);

-- 5. コメント更新
COMMENT ON COLUMN products.embedding IS 'Gemini text-embedding-004 vector (768 dimensions) for semantic search';
COMMENT ON COLUMN performers.embedding IS 'Gemini text-embedding-004 vector (768 dimensions) for semantic search';
