-- 繁体字中国語（zh-TW）カラムの追加

-- products テーブル
ALTER TABLE products ADD COLUMN IF NOT EXISTS title_zh_tw VARCHAR(500);
ALTER TABLE products ADD COLUMN IF NOT EXISTS description_zh_tw TEXT;
CREATE INDEX IF NOT EXISTS idx_products_title_zh_tw ON products(title_zh_tw);

-- performers テーブル
ALTER TABLE performers ADD COLUMN IF NOT EXISTS name_zh_tw VARCHAR(200);
ALTER TABLE performers ADD COLUMN IF NOT EXISTS bio_zh_tw TEXT;
CREATE INDEX IF NOT EXISTS idx_performers_name_zh_tw ON performers(name_zh_tw);

-- tags テーブル
ALTER TABLE tags ADD COLUMN IF NOT EXISTS name_zh_tw VARCHAR(100);
ALTER TABLE tags ADD COLUMN IF NOT EXISTS description_zh_tw TEXT;
CREATE INDEX IF NOT EXISTS idx_tags_name_zh_tw ON tags(name_zh_tw);
