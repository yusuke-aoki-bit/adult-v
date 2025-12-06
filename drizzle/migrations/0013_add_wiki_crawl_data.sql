-- Wikiクロールデータテーブル
-- 各Wikiサイトから収集した商品ID-出演者データを保存

CREATE TABLE IF NOT EXISTS wiki_crawl_data (
  id SERIAL PRIMARY KEY,
  source VARCHAR(50) NOT NULL,               -- 'av-wiki', 'seesaa-wiki', 'shiroutoname', 'nakiny', 'fc2-blog'
  product_code VARCHAR(100) NOT NULL,        -- 品番（300MIUM-1000など）
  performer_name VARCHAR(200) NOT NULL,      -- クロールで取得した出演者名
  source_url TEXT,                           -- 情報取得元のURL
  raw_data JSONB,                            -- 追加情報（タイトル、タグ等）をJSONで保存
  crawled_at TIMESTAMP DEFAULT NOW() NOT NULL,
  processed_at TIMESTAMP                     -- performers/product_performersへの反映完了日時
);

-- インデックス作成
CREATE UNIQUE INDEX IF NOT EXISTS idx_wiki_crawl_source_product_performer
  ON wiki_crawl_data (source, product_code, performer_name);
CREATE INDEX IF NOT EXISTS idx_wiki_crawl_source ON wiki_crawl_data (source);
CREATE INDEX IF NOT EXISTS idx_wiki_crawl_product_code ON wiki_crawl_data (product_code);
CREATE INDEX IF NOT EXISTS idx_wiki_crawl_performer_name ON wiki_crawl_data (performer_name);
CREATE INDEX IF NOT EXISTS idx_wiki_crawl_processed ON wiki_crawl_data (processed_at);
