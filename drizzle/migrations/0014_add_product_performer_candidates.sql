-- 出演者候補テーブル（レビュー用中間テーブル）
-- wiki_crawl_dataからの候補をレビュー後にproduct_performersへ反映

CREATE TABLE IF NOT EXISTS product_performer_candidates (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  performer_name VARCHAR(200) NOT NULL,
  source VARCHAR(50) NOT NULL,             -- 'wiki_crawl', 'title_extract', 'manual', etc.
  source_detail TEXT,                       -- wiki_crawl_data.source や抽出元の詳細情報
  confidence_score DECIMAL(3,2) DEFAULT 0.5, -- 信頼度スコア (0.00-1.00)
  status VARCHAR(20) DEFAULT 'pending' NOT NULL, -- 'pending', 'approved', 'rejected'
  reviewed_at TIMESTAMP,
  reviewer_note TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- インデックス作成
CREATE UNIQUE INDEX IF NOT EXISTS idx_candidates_product_performer
  ON product_performer_candidates (product_id, performer_name);
CREATE INDEX IF NOT EXISTS idx_candidates_status ON product_performer_candidates (status);
CREATE INDEX IF NOT EXISTS idx_candidates_source ON product_performer_candidates (source);
CREATE INDEX IF NOT EXISTS idx_candidates_confidence ON product_performer_candidates (confidence_score);
CREATE INDEX IF NOT EXISTS idx_candidates_created ON product_performer_candidates (created_at);

-- 更新トリガー
CREATE OR REPLACE FUNCTION update_candidates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_candidates_updated_at
  BEFORE UPDATE ON product_performer_candidates
  FOR EACH ROW
  EXECUTE FUNCTION update_candidates_updated_at();
