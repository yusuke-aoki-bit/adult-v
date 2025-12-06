-- 商品レビューテーブル
CREATE TABLE IF NOT EXISTS product_reviews (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    asp_name VARCHAR(50) NOT NULL,
    reviewer_name VARCHAR(100),
    rating DECIMAL(3, 1),
    max_rating DECIMAL(3, 1) DEFAULT 5,
    title TEXT,
    content TEXT,
    review_date TIMESTAMP,
    helpful INTEGER DEFAULT 0,
    source_review_id VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_product_reviews_product ON product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_asp ON product_reviews(asp_name);
CREATE INDEX IF NOT EXISTS idx_product_reviews_rating ON product_reviews(rating);
CREATE INDEX IF NOT EXISTS idx_product_reviews_date ON product_reviews(review_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_reviews_source ON product_reviews(product_id, asp_name, source_review_id);

-- 商品評価サマリーテーブル
CREATE TABLE IF NOT EXISTS product_rating_summary (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    asp_name VARCHAR(50) NOT NULL,
    average_rating DECIMAL(3, 2),
    max_rating DECIMAL(3, 1) DEFAULT 5,
    total_reviews INTEGER DEFAULT 0,
    rating_distribution JSONB,
    last_updated TIMESTAMP NOT NULL DEFAULT NOW()
);

-- インデックス
CREATE UNIQUE INDEX IF NOT EXISTS idx_rating_summary_product_asp ON product_rating_summary(product_id, asp_name);
CREATE INDEX IF NOT EXISTS idx_rating_summary_product ON product_rating_summary(product_id);
CREATE INDEX IF NOT EXISTS idx_rating_summary_avg ON product_rating_summary(average_rating);
