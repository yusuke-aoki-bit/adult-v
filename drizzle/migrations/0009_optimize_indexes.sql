-- Optimize database indexes for better query performance

-- Products table indexes
CREATE INDEX IF NOT EXISTS idx_products_release_date_desc ON products(release_date DESC) WHERE release_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_created_at_desc ON products(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_duration ON products(duration) WHERE duration IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_title_gin ON products USING gin(to_tsvector('simple', title));

-- Product sources indexes
CREATE INDEX IF NOT EXISTS idx_product_sources_asp_name ON product_sources(asp_name);
CREATE INDEX IF NOT EXISTS idx_product_sources_original_product_id ON product_sources(original_product_id);
CREATE INDEX IF NOT EXISTS idx_product_sources_composite ON product_sources(asp_name, product_id);

-- Product performers indexes (for actress search)
CREATE INDEX IF NOT EXISTS idx_product_performers_performer_id ON product_performers(performer_id);
CREATE INDEX IF NOT EXISTS idx_product_performers_composite ON product_performers(performer_id, product_id);

-- Performers indexes
CREATE INDEX IF NOT EXISTS idx_performers_name_gin ON performers USING gin(to_tsvector('simple', name));
CREATE INDEX IF NOT EXISTS idx_performers_name_lower ON performers(LOWER(name));

-- Product tags indexes (for tag filtering)
CREATE INDEX IF NOT EXISTS idx_product_tags_tag_id ON product_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_product_tags_composite ON product_tags(tag_id, product_id);

-- Tags indexes
CREATE INDEX IF NOT EXISTS idx_tags_category ON tags(category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tags_name_lower ON tags(LOWER(name));

-- Product images indexes
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_asp_name ON product_images(asp_name);

-- Product views indexes (for ranking)
CREATE INDEX IF NOT EXISTS idx_product_views_product_id ON product_views(product_id);
CREATE INDEX IF NOT EXISTS idx_product_views_viewed_at ON product_views(viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_views_composite ON product_views(product_id, viewed_at DESC);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_products_sources_join ON product_sources(product_id, asp_name);

-- Partial index for products with thumbnails (common filter)
CREATE INDEX IF NOT EXISTS idx_products_with_thumbnail ON products(id) WHERE default_thumbnail_url IS NOT NULL;

-- Index for full-text search if using PostgreSQL's built-in FTS
CREATE INDEX IF NOT EXISTS idx_products_fts ON products USING gin(
  to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, ''))
);

-- Index for performer aliases (for deduplication)
CREATE INDEX IF NOT EXISTS idx_performer_aliases_name ON performer_aliases(alias_name);
CREATE INDEX IF NOT EXISTS idx_performer_aliases_performer_id ON performer_aliases(performer_id);

-- Analyze tables for query planner optimization
ANALYZE products;
ANALYZE product_sources;
ANALYZE product_performers;
ANALYZE performers;
ANALYZE product_tags;
ANALYZE tags;
ANALYZE product_images;
ANALYZE product_views;
ANALYZE performer_aliases;
