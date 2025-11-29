-- b10f.jp 生データテーブル作成マイグレーション

-- b10f CSVデータ格納テーブル
CREATE TABLE IF NOT EXISTS b10f_raw_csv (
  id SERIAL PRIMARY KEY,
  csv_data TEXT NOT NULL,
  fetched_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_b10f_raw_csv_fetched_at ON b10f_raw_csv(fetched_at DESC);

-- コメント追加
COMMENT ON TABLE b10f_raw_csv IS 'b10f.jp CSVデータ生保存（リカバリー用）';
COMMENT ON COLUMN b10f_raw_csv.csv_data IS '生CSVデータ（全行）';
COMMENT ON COLUMN b10f_raw_csv.fetched_at IS '取得日時';
