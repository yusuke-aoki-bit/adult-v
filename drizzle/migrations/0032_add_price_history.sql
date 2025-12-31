-- 価格履歴テーブル（セールアラート＆価格追跡機能用）
CREATE TABLE price_history (
    id SERIAL PRIMARY KEY,
    product_source_id INTEGER NOT NULL REFERENCES product_sources(id) ON DELETE CASCADE,
    price INTEGER NOT NULL,
    sale_price INTEGER,
    discount_percent INTEGER,
    recorded_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_price_history_product_source ON price_history(product_source_id);
CREATE INDEX idx_price_history_recorded_at ON price_history(recorded_at);
CREATE INDEX idx_price_history_product_source_recorded ON price_history(product_source_id, recorded_at DESC);

-- 重複防止（同日に複数回記録しない）
CREATE UNIQUE INDEX idx_price_history_unique_daily ON price_history(product_source_id, DATE(recorded_at));
