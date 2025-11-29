-- 出演者画像カラム追加マイグレーション

-- performersテーブルにimage_urlカラムを追加
ALTER TABLE performers
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- インデックス作成（画像があるものを素早く検索できるように）
CREATE INDEX IF NOT EXISTS idx_performers_with_image ON performers(image_url) WHERE image_url IS NOT NULL;

-- コメント追加
COMMENT ON COLUMN performers.image_url IS '出演者のプロフィール画像URL';
