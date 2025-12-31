-- 動画タイムスタンプテーブル（試聴→購入コンバージョン強化機能用）
CREATE TABLE video_timestamps (
    id SERIAL PRIMARY KEY,
    product_video_id INTEGER NOT NULL REFERENCES product_videos(id) ON DELETE CASCADE,
    timestamp_seconds INTEGER NOT NULL,
    label VARCHAR(100),
    vote_count INTEGER DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_video_timestamps_video ON video_timestamps(product_video_id);
CREATE INDEX idx_video_timestamps_votes ON video_timestamps(vote_count DESC);

-- 同じ動画の同じタイムスタンプは重複不可
CREATE UNIQUE INDEX idx_video_timestamps_unique ON video_timestamps(product_video_id, timestamp_seconds);
