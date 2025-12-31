-- Migration: Add product_prices table
-- Date: 2024-12-31
-- Description: Create a separate table for product prices by type (download, streaming, hd, 4k, etc.)

-- 1. Create the new product_prices table
CREATE TABLE IF NOT EXISTS product_prices (
    id SERIAL PRIMARY KEY,
    product_source_id INTEGER NOT NULL REFERENCES product_sources(id) ON DELETE CASCADE,
    price_type VARCHAR(30) NOT NULL, -- 'download', 'streaming', 'hd', '4k', 'sd', 'rental', 'subscription'
    price INTEGER NOT NULL, -- 価格（円）
    currency VARCHAR(3) DEFAULT 'JPY',
    is_default BOOLEAN DEFAULT FALSE, -- この価格タイプがデフォルト（代表価格）かどうか
    display_order INTEGER DEFAULT 0, -- 表示順（小さいほど優先）
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Create indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_prices_source_type ON product_prices(product_source_id, price_type);
CREATE INDEX IF NOT EXISTS idx_prices_source ON product_prices(product_source_id);
CREATE INDEX IF NOT EXISTS idx_prices_type ON product_prices(price_type);

-- 3. Migrate existing data from product_sources to product_prices
-- Note: product_sources still has price column for backward compatibility

-- Migrate download_price
INSERT INTO product_prices (product_source_id, price_type, price, is_default, display_order)
SELECT id, 'download', download_price, FALSE, 2
FROM product_sources
WHERE download_price IS NOT NULL
ON CONFLICT (product_source_id, price_type) DO NOTHING;

-- Migrate streaming_price
INSERT INTO product_prices (product_source_id, price_type, price, is_default, display_order)
SELECT id, 'streaming', streaming_price, FALSE, 3
FROM product_sources
WHERE streaming_price IS NOT NULL
ON CONFLICT (product_source_id, price_type) DO NOTHING;

-- Migrate hd_price
INSERT INTO product_prices (product_source_id, price_type, price, is_default, display_order)
SELECT id, 'hd', hd_price, TRUE, 1
FROM product_sources
WHERE hd_price IS NOT NULL
ON CONFLICT (product_source_id, price_type) DO NOTHING;

-- Migrate four_k_price
INSERT INTO product_prices (product_source_id, price_type, price, is_default, display_order)
SELECT id, '4k', four_k_price, FALSE, 0
FROM product_sources
WHERE four_k_price IS NOT NULL
ON CONFLICT (product_source_id, price_type) DO NOTHING;

-- 4. Drop old columns from product_sources (optional - can be done later after verification)
-- WARNING: Only run these after verifying data migration is complete!
-- ALTER TABLE product_sources DROP COLUMN IF EXISTS download_price;
-- ALTER TABLE product_sources DROP COLUMN IF EXISTS streaming_price;
-- ALTER TABLE product_sources DROP COLUMN IF EXISTS hd_price;
-- ALTER TABLE product_sources DROP COLUMN IF EXISTS four_k_price;

-- 5. Update updated_at timestamp on product_prices when row is updated
CREATE OR REPLACE FUNCTION update_product_prices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_product_prices_updated_at ON product_prices;
CREATE TRIGGER trigger_update_product_prices_updated_at
    BEFORE UPDATE ON product_prices
    FOR EACH ROW
    EXECUTE FUNCTION update_product_prices_updated_at();

-- Done
SELECT 'Migration completed: product_prices table created' AS status;
