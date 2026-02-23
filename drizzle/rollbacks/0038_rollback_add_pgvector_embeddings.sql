-- Rollback: 0038_add_pgvector_embeddings.sql
-- WARNING: This rollback may result in data loss. Always backup before executing.
-- Run via: pnpm run db:rollback -- --migration 0038

-- Drop partial indexes on NULL embeddings
DROP INDEX IF EXISTS idx_performers_embedding_null;
DROP INDEX IF EXISTS idx_products_embedding_null;

-- Remove comments (set to NULL)
COMMENT ON COLUMN performers.embedding IS NULL;
COMMENT ON COLUMN products.embedding_updated_at IS NULL;
COMMENT ON COLUMN products.embedding_text_hash IS NULL;
COMMENT ON COLUMN products.embedding IS NULL;

-- Drop columns from performers
ALTER TABLE performers DROP COLUMN IF EXISTS embedding_updated_at;
ALTER TABLE performers DROP COLUMN IF EXISTS embedding_text_hash;
ALTER TABLE performers DROP COLUMN IF EXISTS embedding;

-- Drop columns from products
ALTER TABLE products DROP COLUMN IF EXISTS embedding_updated_at;
ALTER TABLE products DROP COLUMN IF EXISTS embedding_text_hash;
ALTER TABLE products DROP COLUMN IF EXISTS embedding;

-- Drop pgvector extension (only if no other tables use it)
-- WARNING: This will fail if other objects depend on the vector type
DROP EXTENSION IF EXISTS vector;
