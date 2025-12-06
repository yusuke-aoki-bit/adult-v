-- Add currency and subscription columns to product_sources
ALTER TABLE product_sources ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'JPY';
ALTER TABLE product_sources ADD COLUMN IF NOT EXISTS is_subscription BOOLEAN DEFAULT false;

-- Add AI review columns to performers
ALTER TABLE performers ADD COLUMN IF NOT EXISTS ai_review TEXT;
ALTER TABLE performers ADD COLUMN IF NOT EXISTS ai_review_updated_at TIMESTAMP;

-- Update existing DTI records with is_subscription based on price
-- Price = 0 means subscription-based content
UPDATE product_sources
SET is_subscription = true
WHERE asp_name = 'DTI' AND (price IS NULL OR price = 0);

-- Update Japanska records as subscription
UPDATE product_sources
SET is_subscription = true
WHERE asp_name = 'Japanska';

-- DTI records with price > 0 are PPV (single purchase)
UPDATE product_sources
SET is_subscription = false
WHERE asp_name = 'DTI' AND price > 0;

-- Set currency to USD for DTI (prices stored in USD equivalent converted to JPY at 150 rate)
-- Note: The price is already converted to JPY, but we track original currency
UPDATE product_sources
SET currency = 'USD'
WHERE asp_name = 'DTI' AND price > 0;

-- Create index for subscription queries
CREATE INDEX IF NOT EXISTS idx_sources_subscription ON product_sources(is_subscription);
CREATE INDEX IF NOT EXISTS idx_sources_currency ON product_sources(currency);

-- Create index for AI review searches
CREATE INDEX IF NOT EXISTS idx_performers_ai_review ON performers(ai_review_updated_at);
