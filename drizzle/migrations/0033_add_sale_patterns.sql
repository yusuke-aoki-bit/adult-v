-- セールパターンテーブル（購入タイミング最適化機能用）
CREATE TABLE sale_patterns (
    id SERIAL PRIMARY KEY,
    product_source_id INTEGER REFERENCES product_sources(id) ON DELETE CASCADE,
    performer_id INTEGER REFERENCES performers(id) ON DELETE CASCADE,
    maker_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
    pattern_type VARCHAR(50) NOT NULL,  -- 'product', 'performer', 'maker', 'global'
    month_distribution JSONB,  -- {1: 0.05, 2: 0.03, ..., 12: 0.15}
    day_of_week_distribution JSONB,  -- {0: 0.1, 1: 0.15, ..., 6: 0.12}
    avg_discount_percent DECIMAL(5,2),
    avg_sale_duration_days DECIMAL(5,2),
    sale_frequency_per_year DECIMAL(5,2),
    total_sales_count INTEGER DEFAULT 0,
    last_sale_date DATE,
    last_calculated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_sale_patterns_type ON sale_patterns(pattern_type);
CREATE INDEX idx_sale_patterns_performer ON sale_patterns(performer_id);
CREATE INDEX idx_sale_patterns_maker ON sale_patterns(maker_id);
CREATE INDEX idx_sale_patterns_product_source ON sale_patterns(product_source_id);

-- 各パターンタイプごとにユニーク制約
CREATE UNIQUE INDEX idx_sale_patterns_product_unique ON sale_patterns(product_source_id) WHERE pattern_type = 'product';
CREATE UNIQUE INDEX idx_sale_patterns_performer_unique ON sale_patterns(performer_id) WHERE pattern_type = 'performer';
CREATE UNIQUE INDEX idx_sale_patterns_maker_unique ON sale_patterns(maker_id) WHERE pattern_type = 'maker';
