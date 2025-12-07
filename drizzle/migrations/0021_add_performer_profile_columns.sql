-- 出演者プロフィール情報カラム追加
-- Sokmil Actor API等から取得した身体情報を保存

-- 身長 (cm)
ALTER TABLE performers ADD COLUMN IF NOT EXISTS height INTEGER;

-- スリーサイズ (cm)
ALTER TABLE performers ADD COLUMN IF NOT EXISTS bust INTEGER;
ALTER TABLE performers ADD COLUMN IF NOT EXISTS waist INTEGER;
ALTER TABLE performers ADD COLUMN IF NOT EXISTS hip INTEGER;

-- カップサイズ
ALTER TABLE performers ADD COLUMN IF NOT EXISTS cup VARCHAR(10);

-- 生年月日
ALTER TABLE performers ADD COLUMN IF NOT EXISTS birthday DATE;

-- 血液型
ALTER TABLE performers ADD COLUMN IF NOT EXISTS blood_type VARCHAR(10);

-- 出身地
ALTER TABLE performers ADD COLUMN IF NOT EXISTS birthplace VARCHAR(100);

-- 趣味・特技
ALTER TABLE performers ADD COLUMN IF NOT EXISTS hobbies TEXT;

-- Twitter/X アカウント
ALTER TABLE performers ADD COLUMN IF NOT EXISTS twitter_id VARCHAR(100);

-- Instagram アカウント
ALTER TABLE performers ADD COLUMN IF NOT EXISTS instagram_id VARCHAR(100);

-- デビュー年
ALTER TABLE performers ADD COLUMN IF NOT EXISTS debut_year INTEGER;

-- 引退フラグ
ALTER TABLE performers ADD COLUMN IF NOT EXISTS is_retired BOOLEAN DEFAULT FALSE;

-- 各サイトでのID（クロスリファレンス用）
-- サイト別女優ID保存テーブル
CREATE TABLE IF NOT EXISTS performer_external_ids (
    id SERIAL PRIMARY KEY,
    performer_id INTEGER NOT NULL REFERENCES performers(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL, -- 'sokmil', 'fanza', 'mgs', 'b10f', etc.
    external_id VARCHAR(200) NOT NULL, -- そのサイトでの女優ID
    external_url TEXT, -- そのサイトでの女優ページURL
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(performer_id, provider)
);

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_performers_height ON performers(height);
CREATE INDEX IF NOT EXISTS idx_performers_cup ON performers(cup);
CREATE INDEX IF NOT EXISTS idx_performers_birthday ON performers(birthday);
CREATE INDEX IF NOT EXISTS idx_performer_external_ids_provider ON performer_external_ids(provider);
CREATE INDEX IF NOT EXISTS idx_performer_external_ids_external ON performer_external_ids(provider, external_id);
