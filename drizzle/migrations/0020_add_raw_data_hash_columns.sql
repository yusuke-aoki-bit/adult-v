-- 生データテーブルにhash/processedAtカラムを追加
-- 重複検出と再処理判定のため

-- DUGA生データにhash/processedAtカラム追加
ALTER TABLE duga_raw_responses
  ADD COLUMN IF NOT EXISTS hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_duga_raw_hash ON duga_raw_responses(hash);
CREATE UNIQUE INDEX IF NOT EXISTS idx_duga_raw_product_unique ON duga_raw_responses(product_id);

-- ソクミル生データにhash/processedAtカラム追加
ALTER TABLE sokmil_raw_responses
  ADD COLUMN IF NOT EXISTS hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_sokmil_raw_hash ON sokmil_raw_responses(hash);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sokmil_raw_item_type_unique ON sokmil_raw_responses(item_id, api_type);

-- MGS生データにhash/processedAtカラム追加
ALTER TABLE mgs_raw_pages
  ADD COLUMN IF NOT EXISTS hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_mgs_raw_hash ON mgs_raw_pages(hash);

-- B10F生データにhash/processedAtカラム追加
ALTER TABLE b10f_raw_csv
  ADD COLUMN IF NOT EXISTS hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_b10f_raw_hash ON b10f_raw_csv(hash);

-- product_raw_data_linksテーブルにraw_data_table/content_hashカラム追加
ALTER TABLE product_raw_data_links
  ADD COLUMN IF NOT EXISTS raw_data_table TEXT,
  ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64);

-- 既存データのraw_data_table更新
UPDATE product_raw_data_links
SET raw_data_table = CASE
  WHEN source_type = 'duga' THEN 'duga_raw_responses'
  WHEN source_type = 'sokmil' THEN 'sokmil_raw_responses'
  WHEN source_type = 'mgs' THEN 'mgs_raw_pages'
  ELSE 'raw_html_data'
END
WHERE raw_data_table IS NULL;

-- raw_data_tableにNOT NULL制約を追加（既存データ更新後）
-- ALTER TABLE product_raw_data_links ALTER COLUMN raw_data_table SET NOT NULL;

-- コメント
COMMENT ON COLUMN duga_raw_responses.hash IS '重複・更新検出用SHA256ハッシュ';
COMMENT ON COLUMN duga_raw_responses.processed_at IS 'productsへの処理完了日時';
COMMENT ON COLUMN sokmil_raw_responses.hash IS '重複・更新検出用SHA256ハッシュ';
COMMENT ON COLUMN sokmil_raw_responses.processed_at IS 'productsへの処理完了日時';
COMMENT ON COLUMN mgs_raw_pages.hash IS '重複・更新検出用SHA256ハッシュ';
COMMENT ON COLUMN mgs_raw_pages.processed_at IS 'productsへの処理完了日時';
COMMENT ON COLUMN product_raw_data_links.raw_data_table IS '参照先生データテーブル名';
COMMENT ON COLUMN product_raw_data_links.content_hash IS '処理時点のコンテンツハッシュ（再処理判定用）';
