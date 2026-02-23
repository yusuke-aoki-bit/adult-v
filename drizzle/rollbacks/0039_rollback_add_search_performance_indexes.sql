-- Rollback: 0039_add_search_performance_indexes.sql
-- WARNING: This rollback may result in data loss. Always backup before executing.
-- Run via: pnpm run db:rollback -- --migration 0039

-- Drop image/video EXISTS check indexes
DROP INDEX IF EXISTS idx_images_product_exists;
DROP INDEX IF EXISTS idx_videos_product_exists;

-- Drop active sales index
DROP INDEX IF EXISTS idx_sales_active_source;

-- Drop product ID trigram indexes
DROP INDEX IF EXISTS idx_sources_original_id_trgm;
DROP INDEX IF EXISTS idx_products_normalized_id_trgm;

-- Drop tag name trigram index
DROP INDEX IF EXISTS idx_tags_name_trgm;

-- Drop performer name trigram indexes
DROP INDEX IF EXISTS idx_performers_name_kana_trgm;
DROP INDEX IF EXISTS idx_performers_name_trgm;

-- Drop pg_trgm extension (only if no other objects depend on it)
-- WARNING: This will fail if other indexes or objects depend on pg_trgm
DROP EXTENSION IF EXISTS pg_trgm;
