-- GCS URLカラムを追加
-- 大容量データをCloud Storageに保存し、DBにはURLのみ保持する

-- raw_csv_data: raw_dataをnull可に変更し、gcs_urlを追加
ALTER TABLE raw_csv_data ALTER COLUMN raw_data DROP NOT NULL;
ALTER TABLE raw_csv_data ADD COLUMN IF NOT EXISTS gcs_url TEXT;

-- raw_html_data: html_contentをnull可に変更し、gcs_urlを追加
ALTER TABLE raw_html_data ALTER COLUMN html_content DROP NOT NULL;
ALTER TABLE raw_html_data ADD COLUMN IF NOT EXISTS gcs_url TEXT;

-- wiki_crawl_data: gcs_urlを追加
ALTER TABLE wiki_crawl_data ADD COLUMN IF NOT EXISTS gcs_url TEXT;

-- コメント追加
COMMENT ON COLUMN raw_csv_data.gcs_url IS 'GCSに保存した場合のURL (gs://bucket/path)';
COMMENT ON COLUMN raw_html_data.gcs_url IS 'GCSに保存した場合のURL (gs://bucket/path)';
COMMENT ON COLUMN wiki_crawl_data.gcs_url IS 'GCSに保存した場合のURL (gs://bucket/path)';
