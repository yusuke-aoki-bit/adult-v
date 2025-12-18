-- GSC SEO関連テーブルのマイグレーション
-- 実行: psql -h 10.33.0.3 -U adult-v -d postgres -f scripts/migrate-seo-tables.sql

-- seo_metrics テーブル作成
CREATE TABLE IF NOT EXISTS seo_metrics (
  id SERIAL PRIMARY KEY,
  query_type VARCHAR(20) NOT NULL,
  query_or_url TEXT NOT NULL,
  performer_id INTEGER REFERENCES performers(id) ON DELETE SET NULL,
  clicks INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  ctr DECIMAL(6, 4),
  position DECIMAL(6, 2),
  date_start DATE NOT NULL,
  date_end DATE NOT NULL,
  fetched_at TIMESTAMP DEFAULT NOW() NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- seo_metrics インデックス作成
CREATE INDEX IF NOT EXISTS idx_seo_metrics_query_type ON seo_metrics(query_type);
CREATE INDEX IF NOT EXISTS idx_seo_metrics_performer ON seo_metrics(performer_id);
CREATE INDEX IF NOT EXISTS idx_seo_metrics_position ON seo_metrics(position);
CREATE INDEX IF NOT EXISTS idx_seo_metrics_impressions ON seo_metrics(impressions);
CREATE INDEX IF NOT EXISTS idx_seo_metrics_date ON seo_metrics(date_start, date_end);
CREATE UNIQUE INDEX IF NOT EXISTS idx_seo_metrics_query_url_date ON seo_metrics(query_type, query_or_url, date_start, date_end);

-- footer_featured_actresses テーブル作成
CREATE TABLE IF NOT EXISTS footer_featured_actresses (
  id SERIAL PRIMARY KEY,
  performer_id INTEGER NOT NULL REFERENCES performers(id) ON DELETE CASCADE,
  performer_name VARCHAR(200) NOT NULL,
  impressions INTEGER DEFAULT 0,
  position DECIMAL(6, 2),
  priority_score INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- footer_featured_actresses インデックス作成
CREATE UNIQUE INDEX IF NOT EXISTS idx_footer_featured_performer ON footer_featured_actresses(performer_id);
CREATE INDEX IF NOT EXISTS idx_footer_featured_priority ON footer_featured_actresses(priority_score);

-- 確認
SELECT 'seo_metrics' as table_name, COUNT(*) as count FROM seo_metrics
UNION ALL
SELECT 'footer_featured_actresses', COUNT(*) FROM footer_featured_actresses;
