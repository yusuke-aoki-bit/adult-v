-- 商品名寄せ用マッピングテーブル作成マイグレーション

-- 女優-作品IDマッピングテーブル (av-wiki.net, seesaawiki等から収集)
CREATE TABLE IF NOT EXISTS performer_product_mappings (
  id SERIAL PRIMARY KEY,
  performer_name TEXT NOT NULL,
  product_code TEXT NOT NULL,
  source_site TEXT NOT NULL, -- 'av-wiki', 'seesaawiki', 'nakiny'
  source_url TEXT,
  scraped_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(performer_name, product_code, source_site)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_performer_product_mappings_performer ON performer_product_mappings(performer_name);
CREATE INDEX IF NOT EXISTS idx_performer_product_mappings_product_code ON performer_product_mappings(product_code);
CREATE INDEX IF NOT EXISTS idx_performer_product_mappings_source ON performer_product_mappings(source_site);

-- 名寄せ結果テーブル (同一商品グループ)
CREATE TABLE IF NOT EXISTS product_identity_groups (
  id SERIAL PRIMARY KEY,
  master_product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 商品-グループリレーション
CREATE TABLE IF NOT EXISTS product_identity_group_members (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES product_identity_groups(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  confidence_score DECIMAL(3, 2) DEFAULT 1.0, -- 0.00-1.00 の信頼度スコア
  matching_method TEXT, -- 'product_code', 'performer_title', 'manual'
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(group_id, product_id)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_product_identity_group_members_group ON product_identity_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_product_identity_group_members_product ON product_identity_group_members(product_id);

-- コメント追加
COMMENT ON TABLE performer_product_mappings IS '女優-作品IDマッピング（Wiki等から収集）';
COMMENT ON COLUMN performer_product_mappings.product_code IS '品番 (例: STARS-123, ABP-456)';
COMMENT ON COLUMN performer_product_mappings.source_site IS 'データ収集元サイト';

COMMENT ON TABLE product_identity_groups IS '名寄せ結果: 同一商品グループ';
COMMENT ON COLUMN product_identity_groups.master_product_id IS '代表商品ID';

COMMENT ON TABLE product_identity_group_members IS '商品-グループメンバーシップ';
COMMENT ON COLUMN product_identity_group_members.confidence_score IS 'マッチング信頼度 (0.00-1.00)';
COMMENT ON COLUMN product_identity_group_members.matching_method IS 'マッチング手法';
