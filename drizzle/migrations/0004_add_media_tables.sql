-- 女優画像テーブル (1女優に複数画像)
CREATE TABLE IF NOT EXISTS performer_images (
  id SERIAL PRIMARY KEY,
  performer_id INTEGER NOT NULL REFERENCES performers(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  image_type VARCHAR(50), -- 'profile', 'thumbnail', 'banner', 'gallery' など
  width INTEGER, -- 画像の幅
  height INTEGER, -- 画像の高さ
  source VARCHAR(100), -- 'av-wiki', 'seesaa-wiki', 'manual' など
  is_primary BOOLEAN DEFAULT false, -- メイン画像かどうか
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- インデックス
CREATE INDEX idx_performer_images_performer ON performer_images(performer_id);
CREATE INDEX idx_performer_images_type ON performer_images(image_type);
CREATE INDEX idx_performer_images_primary ON performer_images(performer_id, is_primary);

-- 作品画像テーブル (1作品に複数画像)
CREATE TABLE IF NOT EXISTS product_images (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  image_type VARCHAR(50) NOT NULL, -- 'thumbnail', 'cover', 'sample', 'screenshot' など
  display_order INTEGER DEFAULT 0, -- 表示順序
  width INTEGER,
  height INTEGER,
  asp_name VARCHAR(50), -- 画像の取得元ASP
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- インデックス
CREATE INDEX idx_product_images_product ON product_images(product_id);
CREATE INDEX idx_product_images_type ON product_images(image_type);
CREATE INDEX idx_product_images_order ON product_images(product_id, display_order);
CREATE INDEX idx_product_images_asp ON product_images(asp_name);

-- 作品動画テーブル (1作品に複数動画URL)
CREATE TABLE IF NOT EXISTS product_videos (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  video_url TEXT NOT NULL,
  video_type VARCHAR(50) NOT NULL, -- 'streaming', 'download', 'preview', 'trailer' など
  quality VARCHAR(50), -- '1080p', '720p', '480p', '4K' など
  duration INTEGER, -- 再生時間（秒）
  file_size BIGINT, -- ファイルサイズ（バイト）
  format VARCHAR(50), -- 'mp4', 'wmv', 'm3u8' など
  asp_name VARCHAR(50), -- 動画の取得元ASP
  requires_auth BOOLEAN DEFAULT false, -- 認証が必要かどうか
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- インデックス
CREATE INDEX idx_product_videos_product ON product_videos(product_id);
CREATE INDEX idx_product_videos_type ON product_videos(video_type);
CREATE INDEX idx_product_videos_quality ON product_videos(quality);
CREATE INDEX idx_product_videos_asp ON product_videos(asp_name);

-- 既存のperformersテーブルにプロフィール画像のデフォルトURLカラムを追加（互換性のため）
ALTER TABLE performers ADD COLUMN IF NOT EXISTS profile_image_url TEXT;

-- 既存のproductsテーブルにデフォルトサムネイルURLカラムを追加（互換性のため）
ALTER TABLE products ADD COLUMN IF NOT EXISTS default_thumbnail_url TEXT;

-- コメント追加
COMMENT ON TABLE performer_images IS '女優の複数画像を管理するテーブル';
COMMENT ON TABLE product_images IS '作品の複数画像を管理するテーブル';
COMMENT ON TABLE product_videos IS '作品の複数動画URLを管理するテーブル';
