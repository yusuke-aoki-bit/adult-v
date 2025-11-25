-- Migration: Create archive tables for DTI products
-- Reason: DMM affiliate terms prohibit promotion of DTI sites
-- Date: 2025-11-25

-- Create archived_products table
CREATE TABLE IF NOT EXISTS archived_products (
  id SERIAL PRIMARY KEY,
  original_product_id INTEGER NOT NULL,
  normalized_product_id VARCHAR(100) NOT NULL,
  title VARCHAR(500) NOT NULL,
  release_date DATE,
  description TEXT,
  duration INTEGER,
  default_thumbnail_url TEXT,
  archived_at TIMESTAMP NOT NULL DEFAULT NOW(),
  archived_reason VARCHAR(200) DEFAULT 'DMM affiliate terms - DTI exclusion',
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);

-- Create indexes for archived_products
CREATE INDEX IF NOT EXISTS idx_archived_products_original_id ON archived_products(original_product_id);
CREATE INDEX IF NOT EXISTS idx_archived_products_normalized_id ON archived_products(normalized_product_id);
CREATE INDEX IF NOT EXISTS idx_archived_products_archived_at ON archived_products(archived_at);

-- Create archived_product_sources table
CREATE TABLE IF NOT EXISTS archived_product_sources (
  id SERIAL PRIMARY KEY,
  archived_product_id INTEGER NOT NULL REFERENCES archived_products(id) ON DELETE CASCADE,
  original_source_id INTEGER NOT NULL,
  asp_name VARCHAR(50) NOT NULL,
  original_product_id VARCHAR(100) NOT NULL,
  affiliate_url TEXT,
  price INTEGER,
  data_source VARCHAR(10),
  last_updated TIMESTAMP,
  archived_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for archived_product_sources
CREATE INDEX IF NOT EXISTS idx_archived_sources_product ON archived_product_sources(archived_product_id);
CREATE INDEX IF NOT EXISTS idx_archived_sources_asp ON archived_product_sources(asp_name);

-- Create archived_product_performers junction table
CREATE TABLE IF NOT EXISTS archived_product_performers (
  archived_product_id INTEGER NOT NULL REFERENCES archived_products(id) ON DELETE CASCADE,
  performer_id INTEGER NOT NULL REFERENCES performers(id) ON DELETE CASCADE,
  archived_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (archived_product_id, performer_id)
);

-- Create indexes for archived_product_performers
CREATE INDEX IF NOT EXISTS idx_app_archived_product ON archived_product_performers(archived_product_id);
CREATE INDEX IF NOT EXISTS idx_app_performer ON archived_product_performers(performer_id);

-- Add comment to tables
COMMENT ON TABLE archived_products IS 'Archived products table for DTI sites compliance with DMM affiliate terms';
COMMENT ON TABLE archived_product_sources IS 'Archived product sources for DTI products';
COMMENT ON TABLE archived_product_performers IS 'Junction table linking archived products to performers (performers table remains shared)';
