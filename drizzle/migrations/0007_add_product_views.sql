-- Create product_views table for tracking popularity
CREATE TABLE IF NOT EXISTS product_views (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_views_product_id ON product_views(product_id);
CREATE INDEX IF NOT EXISTS idx_product_views_viewed_at ON product_views(viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_views_product_viewed ON product_views(product_id, viewed_at DESC);

-- Create function to clean up old view records (keep only last 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_product_views() RETURNS void AS $$
BEGIN
  DELETE FROM product_views WHERE viewed_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Create performer_views table for actress ranking
CREATE TABLE IF NOT EXISTS performer_views (
  id SERIAL PRIMARY KEY,
  performer_id INTEGER NOT NULL REFERENCES performers(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performer views
CREATE INDEX IF NOT EXISTS idx_performer_views_performer_id ON performer_views(performer_id);
CREATE INDEX IF NOT EXISTS idx_performer_views_viewed_at ON performer_views(viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_performer_views_performer_viewed ON performer_views(performer_id, viewed_at DESC);

COMMENT ON TABLE product_views IS 'Tracks product page views for popularity ranking';
COMMENT ON TABLE performer_views IS 'Tracks actress page views for popularity ranking';
