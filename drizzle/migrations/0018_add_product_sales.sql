-- セール情報テーブル
CREATE TABLE IF NOT EXISTS product_sales (
    id SERIAL PRIMARY KEY,
    product_source_id INTEGER NOT NULL REFERENCES product_sources(id) ON DELETE CASCADE,
    regular_price INTEGER NOT NULL,
    sale_price INTEGER NOT NULL,
    discount_percent INTEGER,
    sale_type VARCHAR(50),
    sale_name VARCHAR(200),
    start_at TIMESTAMP,
    end_at TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    fetched_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_sales_product_source ON product_sales(product_source_id);
CREATE INDEX IF NOT EXISTS idx_sales_active ON product_sales(is_active);
CREATE INDEX IF NOT EXISTS idx_sales_end_at ON product_sales(end_at);
CREATE INDEX IF NOT EXISTS idx_sales_discount ON product_sales(discount_percent);

-- product_source_idごとに1つのアクティブなセールのみを許可するユニーク制約
-- (同じ商品が複数のセールに含まれる場合は、最新のものだけをアクティブにする)
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_active_unique
ON product_sales(product_source_id)
WHERE is_active = TRUE;

-- コメント
COMMENT ON TABLE product_sales IS 'ASPごとのセール・割引情報';
COMMENT ON COLUMN product_sales.regular_price IS '通常価格（円）';
COMMENT ON COLUMN product_sales.sale_price IS 'セール価格（円）';
COMMENT ON COLUMN product_sales.discount_percent IS '割引率（%）';
COMMENT ON COLUMN product_sales.sale_type IS 'セール種別（timesale, campaign, clearance等）';
COMMENT ON COLUMN product_sales.sale_name IS 'セール名';
COMMENT ON COLUMN product_sales.start_at IS 'セール開始日時';
COMMENT ON COLUMN product_sales.end_at IS 'セール終了日時';
COMMENT ON COLUMN product_sales.is_active IS 'アクティブフラグ（終了したセールはFALSE）';
