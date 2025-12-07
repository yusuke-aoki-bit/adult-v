-- Add AI review columns to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS ai_review text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ai_review_updated_at timestamp;

-- Add index for finding products needing AI review generation
CREATE INDEX IF NOT EXISTS idx_products_ai_review_updated ON products (ai_review_updated_at);
