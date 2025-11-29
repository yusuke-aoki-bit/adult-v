-- 生データ保存用テーブル
-- APIレスポンスやスクレイピング結果をそのまま保存してリカバリー可能にする

-- DUGA API生レスポンス
CREATE TABLE IF NOT EXISTS duga_raw_responses (
  id SERIAL PRIMARY KEY,
  product_id TEXT NOT NULL, -- DUGA商品ID
  api_version TEXT NOT NULL DEFAULT '1.2',
  raw_json JSONB NOT NULL, -- APIレスポンス全体
  fetched_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_duga_raw_product_id ON duga_raw_responses(product_id);
CREATE INDEX idx_duga_raw_fetched_at ON duga_raw_responses(fetched_at DESC);

-- ソクミル API生レスポンス
CREATE TABLE IF NOT EXISTS sokmil_raw_responses (
  id SERIAL PRIMARY KEY,
  item_id TEXT NOT NULL, -- ソクミル商品ID
  api_type TEXT NOT NULL, -- 'item', 'maker', 'label', 'series', 'genre', 'director', 'actor'
  raw_json JSONB NOT NULL, -- APIレスポンス全体
  fetched_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sokmil_raw_item_id ON sokmil_raw_responses(item_id);
CREATE INDEX idx_sokmil_raw_api_type ON sokmil_raw_responses(api_type);
CREATE INDEX idx_sokmil_raw_fetched_at ON sokmil_raw_responses(fetched_at DESC);

-- MGS スクレイピング生データ
CREATE TABLE IF NOT EXISTS mgs_raw_pages (
  id SERIAL PRIMARY KEY,
  product_url TEXT NOT NULL UNIQUE, -- MGS商品ページURL
  product_id TEXT, -- MGS商品ID (抽出後)
  raw_html TEXT NOT NULL, -- ページHTML全体
  raw_json JSONB, -- 抽出したメタデータ
  status_code INTEGER NOT NULL DEFAULT 200,
  fetched_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_mgs_raw_product_url ON mgs_raw_pages(product_url);
CREATE INDEX idx_mgs_raw_product_id ON mgs_raw_pages(product_id);
CREATE INDEX idx_mgs_raw_fetched_at ON mgs_raw_pages(fetched_at DESC);

-- 生データとproductsテーブルのリレーション
CREATE TABLE IF NOT EXISTS product_raw_data_links (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL, -- 'duga', 'sokmil', 'mgs'
  raw_data_id INTEGER NOT NULL, -- 対応する生データテーブルのID
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(product_id, source_type, raw_data_id)
);

CREATE INDEX idx_product_raw_links_product ON product_raw_data_links(product_id);
CREATE INDEX idx_product_raw_links_source ON product_raw_data_links(source_type, raw_data_id);

-- コメント
COMMENT ON TABLE duga_raw_responses IS 'DUGA APIの生レスポンス保存（リカバリー用）';
COMMENT ON TABLE sokmil_raw_responses IS 'ソクミルAPIの生レスポンス保存（リカバリー用）';
COMMENT ON TABLE mgs_raw_pages IS 'MGSスクレイピングの生HTML保存（リカバリー用）';
COMMENT ON TABLE product_raw_data_links IS '商品と生データのリレーション管理';
