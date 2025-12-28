-- AIレビュー翻訳カラム追加
-- 商品のAIレビューと演者のAIレビューを多言語対応

-- 商品AIレビュー翻訳カラム
ALTER TABLE products ADD COLUMN IF NOT EXISTS ai_review_en TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ai_review_zh TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ai_review_ko TEXT;

-- 演者AIレビュー翻訳カラム
ALTER TABLE performers ADD COLUMN IF NOT EXISTS ai_review_en TEXT;
ALTER TABLE performers ADD COLUMN IF NOT EXISTS ai_review_zh TEXT;
ALTER TABLE performers ADD COLUMN IF NOT EXISTS ai_review_ko TEXT;

-- コメント追加
COMMENT ON COLUMN products.ai_review_en IS 'AI生成レビュー（英語）';
COMMENT ON COLUMN products.ai_review_zh IS 'AI生成レビュー（中国語簡体字）';
COMMENT ON COLUMN products.ai_review_ko IS 'AI生成レビュー（韓国語）';

COMMENT ON COLUMN performers.ai_review_en IS 'AI生成演者レビュー（英語）';
COMMENT ON COLUMN performers.ai_review_zh IS 'AI生成演者レビュー（中国語簡体字）';
COMMENT ON COLUMN performers.ai_review_ko IS 'AI生成演者レビュー（韓国語）';
