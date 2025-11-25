-- Migration: Rename archived tables to uncensored tables
-- Reason: Better terminology - these are uncensored (無修正) products, not just archived
-- Date: 2025-11-25

-- Rename tables
ALTER TABLE IF EXISTS archived_product_performers RENAME TO uncensored_product_performers;
ALTER TABLE IF EXISTS archived_product_sources RENAME TO uncensored_product_sources;
ALTER TABLE IF EXISTS archived_products RENAME TO uncensored_products;

-- Rename columns in uncensored_product_sources
ALTER TABLE IF EXISTS uncensored_product_sources
  RENAME COLUMN archived_product_id TO uncensored_product_id;

-- Rename columns in uncensored_product_performers
ALTER TABLE IF EXISTS uncensored_product_performers
  RENAME COLUMN archived_product_id TO uncensored_product_id;

-- Rename indexes for uncensored_products
ALTER INDEX IF EXISTS idx_archived_products_original_id RENAME TO idx_uncensored_products_original_id;
ALTER INDEX IF EXISTS idx_archived_products_normalized_id RENAME TO idx_uncensored_products_normalized_id;
ALTER INDEX IF EXISTS idx_archived_products_archived_at RENAME TO idx_uncensored_products_archived_at;

-- Rename indexes for uncensored_product_sources
ALTER INDEX IF EXISTS idx_archived_sources_product RENAME TO idx_uncensored_sources_product;
ALTER INDEX IF EXISTS idx_archived_sources_asp RENAME TO idx_uncensored_sources_asp;

-- Rename indexes for uncensored_product_performers
ALTER INDEX IF EXISTS idx_app_archived_product RENAME TO idx_upp_uncensored_product;
ALTER INDEX IF EXISTS idx_app_performer RENAME TO idx_upp_performer;

-- Update table comments
COMMENT ON TABLE uncensored_products IS 'Uncensored products table for DTI sites compliance with DMM affiliate terms';
COMMENT ON TABLE uncensored_product_sources IS 'Uncensored product sources';
COMMENT ON TABLE uncensored_product_performers IS 'Junction table linking uncensored products to performers (performers table remains shared)';

-- Update archived_reason default value
ALTER TABLE uncensored_products
  ALTER COLUMN archived_reason SET DEFAULT 'DMM affiliate terms - uncensored content exclusion';
