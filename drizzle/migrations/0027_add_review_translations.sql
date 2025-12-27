-- Add translation columns to product_reviews table
ALTER TABLE product_reviews ADD COLUMN IF NOT EXISTS title_en TEXT;
ALTER TABLE product_reviews ADD COLUMN IF NOT EXISTS title_zh TEXT;
ALTER TABLE product_reviews ADD COLUMN IF NOT EXISTS title_ko TEXT;
ALTER TABLE product_reviews ADD COLUMN IF NOT EXISTS content_en TEXT;
ALTER TABLE product_reviews ADD COLUMN IF NOT EXISTS content_zh TEXT;
ALTER TABLE product_reviews ADD COLUMN IF NOT EXISTS content_ko TEXT;

-- Add index for untranslated reviews lookup
CREATE INDEX IF NOT EXISTS idx_product_reviews_untranslated
ON product_reviews (id)
WHERE content_en IS NULL AND content IS NOT NULL;
