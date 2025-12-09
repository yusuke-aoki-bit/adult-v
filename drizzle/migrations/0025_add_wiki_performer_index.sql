-- Wiki/参考サイトからクロールした出演者インデックステーブル
-- 商品ID、作品タイトルから出演者名を検索するためのテーブル

CREATE TABLE IF NOT EXISTS wiki_performer_index (
  id SERIAL PRIMARY KEY,
  -- 検索キー
  product_code VARCHAR(100),          -- 商品コード（例: "GAREA-123", "tokyo247-mayumi"）
  product_title VARCHAR(500),         -- 作品タイトル（例: "G-AREA いくこ"）
  maker VARCHAR(100),                 -- メーカー/レーベル（例: "tokyo247", "g-area", "s-cute"）

  -- 出演者情報
  performer_name VARCHAR(200) NOT NULL,       -- 出演者名（ひらがな/カタカナ/漢字）
  performer_name_romaji VARCHAR(200),         -- ローマ字名（MAYUMI等）
  performer_name_variants JSONB,              -- 名前の変換候補（ひらがな、カタカナ等）

  -- メタデータ
  source VARCHAR(50) NOT NULL,        -- データ取得元（"erodougazo", "seesaawiki", "minnano-av", "av-wiki"）
  source_url TEXT,                    -- 取得元URL
  confidence INTEGER DEFAULT 100,     -- 信頼度（0-100）
  verified BOOLEAN DEFAULT FALSE,     -- 手動検証済みフラグ

  -- タイムスタンプ
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_wiki_performer_product_code ON wiki_performer_index(product_code);
CREATE INDEX IF NOT EXISTS idx_wiki_performer_product_title ON wiki_performer_index(product_title);
CREATE INDEX IF NOT EXISTS idx_wiki_performer_maker ON wiki_performer_index(maker);
CREATE INDEX IF NOT EXISTS idx_wiki_performer_name ON wiki_performer_index(performer_name);
CREATE INDEX IF NOT EXISTS idx_wiki_performer_source ON wiki_performer_index(source);
CREATE INDEX IF NOT EXISTS idx_wiki_performer_maker_title ON wiki_performer_index(maker, product_title);

-- 複合ユニーク制約（同じソースから同じ商品の同じ出演者は重複登録しない）
CREATE UNIQUE INDEX IF NOT EXISTS idx_wiki_performer_unique
  ON wiki_performer_index(source, COALESCE(product_code, ''), COALESCE(product_title, ''), performer_name);

-- 全文検索用インデックス（タイトル検索高速化）
CREATE INDEX IF NOT EXISTS idx_wiki_performer_title_trgm
  ON wiki_performer_index USING gin(product_title gin_trgm_ops);
