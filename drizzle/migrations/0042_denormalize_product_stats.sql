-- Add denormalized columns to products table for query optimization
-- Eliminates correlated subqueries in getSeriesProducts and product list queries

ALTER TABLE products ADD COLUMN IF NOT EXISTS performer_count INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS has_video BOOLEAN DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS has_active_sale BOOLEAN DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS min_price INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS best_rating NUMERIC(3,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS total_reviews INTEGER DEFAULT 0;

-- Backfill: performer_count
UPDATE products p SET performer_count = (
  SELECT COUNT(*) FROM product_performers pp WHERE pp.product_id = p.id
);

-- Backfill: has_video
UPDATE products p SET has_video = EXISTS (
  SELECT 1 FROM product_videos pv WHERE pv.product_id = p.id
);

-- Backfill: has_active_sale
UPDATE products p SET has_active_sale = EXISTS (
  SELECT 1 FROM product_sources ps
  JOIN product_sales psl ON psl.product_source_id = ps.id
  WHERE ps.product_id = p.id AND psl.is_active = true
    AND (psl.end_at IS NULL OR psl.end_at > NOW())
);

-- Backfill: min_price
UPDATE products p SET min_price = (
  SELECT MIN(ps.price) FROM product_sources ps
  WHERE ps.product_id = p.id AND ps.price > 0
);

-- Backfill: best_rating
UPDATE products p SET best_rating = (
  SELECT MAX(average_rating) FROM product_rating_summary prs
  WHERE prs.product_id = p.id
);

-- Backfill: total_reviews
UPDATE products p SET total_reviews = COALESCE((
  SELECT SUM(total_reviews) FROM product_rating_summary prs
  WHERE prs.product_id = p.id
), 0);

-- Indexes for denormalized columns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_has_video ON products (has_video) WHERE has_video = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_has_sale ON products (has_active_sale) WHERE has_active_sale = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_min_price ON products (min_price) WHERE min_price IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_best_rating ON products (best_rating DESC NULLS LAST);
