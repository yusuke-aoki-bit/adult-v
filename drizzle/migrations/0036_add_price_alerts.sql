-- 価格アラート登録テーブル（サーバーサイドでプッシュ通知を送るため）
CREATE TABLE price_alerts (
    id SERIAL PRIMARY KEY,
    -- プッシュ通知購読情報との紐付け
    subscription_id INTEGER NOT NULL REFERENCES push_subscriptions(id) ON DELETE CASCADE,
    -- 対象商品
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    -- アラート設定
    target_price INTEGER,  -- 目標価格（NULL = セール時に通知）
    notify_on_any_sale BOOLEAN NOT NULL DEFAULT true,  -- セールになったら通知
    -- ステータス
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_notified_at TIMESTAMP,  -- 最後に通知した日時
    -- メタデータ
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_price_alerts_subscription ON price_alerts(subscription_id);
CREATE INDEX idx_price_alerts_product ON price_alerts(product_id);
CREATE INDEX idx_price_alerts_active ON price_alerts(is_active) WHERE is_active = true;

-- 同一購読×商品の重複防止
CREATE UNIQUE INDEX idx_price_alerts_unique ON price_alerts(subscription_id, product_id);

-- 通知履歴テーブル（送信ログ）
CREATE TABLE alert_notifications (
    id SERIAL PRIMARY KEY,
    alert_id INTEGER REFERENCES price_alerts(id) ON DELETE SET NULL,
    subscription_id INTEGER NOT NULL REFERENCES push_subscriptions(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    -- 通知内容
    notification_type VARCHAR(50) NOT NULL,  -- 'price_drop', 'sale_start', 'target_reached'
    title VARCHAR(500) NOT NULL,
    body TEXT NOT NULL,
    -- 価格情報
    original_price INTEGER,
    sale_price INTEGER,
    discount_percent INTEGER,
    -- 送信結果
    sent_at TIMESTAMP NOT NULL DEFAULT NOW(),
    was_successful BOOLEAN NOT NULL DEFAULT true,
    error_message TEXT
);

-- インデックス
CREATE INDEX idx_alert_notifications_subscription ON alert_notifications(subscription_id);
CREATE INDEX idx_alert_notifications_product ON alert_notifications(product_id);
CREATE INDEX idx_alert_notifications_sent_at ON alert_notifications(sent_at DESC);
