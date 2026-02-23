-- Rollback: 0040_migrate_embeddings_to_gemini.sql
-- WARNING: This rollback may result in data loss. Always backup before executing.
-- WARNING: This restores the column to OpenAI 1536 dimensions. All Gemini embeddings will be lost.
-- Run via: pnpm run db:rollback -- --migration 0040

-- Drop indexes first
DROP INDEX IF EXISTS idx_performers_embedding_null;
DROP INDEX IF EXISTS idx_products_embedding_null;

-- Revert performers embedding back to 1536 dimensions (OpenAI)
ALTER TABLE performers DROP COLUMN IF EXISTS embedding;
ALTER TABLE performers ADD COLUMN embedding vector(1536);

-- Revert products embedding back to 1536 dimensions (OpenAI)
ALTER TABLE products DROP COLUMN IF EXISTS embedding;
ALTER TABLE products ADD COLUMN embedding vector(1536);

-- Reset hash/timestamp columns (embeddings are now empty)
UPDATE products SET embedding_text_hash = NULL, embedding_updated_at = NULL
WHERE embedding_text_hash IS NOT NULL;

UPDATE performers SET embedding_text_hash = NULL, embedding_updated_at = NULL
WHERE embedding_text_hash IS NOT NULL;

-- Recreate NULL-check indexes
CREATE INDEX IF NOT EXISTS idx_products_embedding_null
  ON products (id)
  WHERE embedding IS NULL;

CREATE INDEX IF NOT EXISTS idx_performers_embedding_null
  ON performers (id)
  WHERE embedding IS NULL;

-- Restore original comments
COMMENT ON COLUMN products.embedding IS 'OpenAI text-embedding-3-small vector (1536 dimensions) for semantic search';
COMMENT ON COLUMN performers.embedding IS 'OpenAI text-embedding-3-small vector (1536 dimensions) for semantic search';
