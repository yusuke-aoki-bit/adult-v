-- Rollback: 0041_add_performance_indexes.sql
-- WARNING: This rollback may result in data loss. Always backup before executing.
-- Run via: pnpm run db:rollback -- --migration 0041

-- Drop release date + id composite index
DROP INDEX IF EXISTS idx_products_release_id;

-- Drop product sources ASP + price index
DROP INDEX IF EXISTS idx_sources_product_asp_price;

-- Drop rating summary index
DROP INDEX IF EXISTS idx_rating_summary_product_avg;

-- Drop active sales discount index
DROP INDEX IF EXISTS idx_sales_active_discount;

-- Drop performer-product composite index
DROP INDEX IF EXISTS idx_pp_performer_product;
