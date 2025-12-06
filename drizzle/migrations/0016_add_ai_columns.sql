-- AI生成コンテンツカラムを追加
-- クローラーがGemini APIで生成した説明文やタグを保存

-- AI説明文詳細（JSON形式でキャッチコピー、短い説明、詳細説明などを格納）
ALTER TABLE products ADD COLUMN IF NOT EXISTS ai_description JSONB;

-- AIが生成したキャッチコピー（検索・表示用に個別カラム化）
ALTER TABLE products ADD COLUMN IF NOT EXISTS ai_catchphrase VARCHAR(500);

-- AIが生成した短い説明文
ALTER TABLE products ADD COLUMN IF NOT EXISTS ai_short_description TEXT;

-- AI抽出タグ（JSON形式でgenres, attributes, plays, situationsを格納）
ALTER TABLE products ADD COLUMN IF NOT EXISTS ai_tags JSONB;

-- インデックス追加（必要に応じてコメントアウト解除）
-- CREATE INDEX IF NOT EXISTS idx_products_ai_catchphrase ON products(ai_catchphrase) WHERE ai_catchphrase IS NOT NULL;
