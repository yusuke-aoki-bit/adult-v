-- Rollback: 0042_denormalize_product_stats.sql
-- WARNING: This rollback may result in data loss. Always backup before executing.
-- Run via: pnpm run db:rollback -- --migration 0042

-- Drop indexes on denormalized columns
DROP INDEX IF EXISTS idx_products_best_rating;
DROP INDEX IF EXISTS idx_products_min_price;
DROP INDEX IF EXISTS idx_products_has_sale;
DROP INDEX IF EXISTS idx_products_has_video;

-- Drop denormalized columns
ALTER TABLE products DROP COLUMN IF EXISTS total_reviews;
ALTER TABLE products DROP COLUMN IF EXISTS best_rating;
ALTER TABLE products DROP COLUMN IF EXISTS min_price;
ALTER TABLE products DROP COLUMN IF EXISTS has_active_sale;
ALTER TABLE products DROP COLUMN IF EXISTS has_video;
ALTER TABLE products DROP COLUMN IF EXISTS performer_count;
