-- ============================================
-- 公開お気に入りリスト機能
-- ============================================

-- 公開お気に入りリストテーブル
CREATE TABLE IF NOT EXISTS public_favorite_lists (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,  -- Firebase UID
    title VARCHAR(200) NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT true,
    view_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 公開リストのアイテムテーブル
CREATE TABLE IF NOT EXISTS public_favorite_list_items (
    id SERIAL PRIMARY KEY,
    list_id INTEGER NOT NULL REFERENCES public_favorite_lists(id) ON DELETE CASCADE,
    item_type VARCHAR(50) NOT NULL,  -- 'product' or 'performer'
    item_id VARCHAR(100) NOT NULL,   -- product_id or performer_id
    note TEXT,  -- ユーザーのコメント
    added_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 公開リストへのいいね
CREATE TABLE IF NOT EXISTS public_favorite_list_likes (
    id SERIAL PRIMARY KEY,
    list_id INTEGER NOT NULL REFERENCES public_favorite_lists(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,  -- Firebase UID
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- インデックス（公開リスト）
CREATE INDEX IF NOT EXISTS idx_public_lists_user ON public_favorite_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_public_lists_public ON public_favorite_lists(is_public);
CREATE INDEX IF NOT EXISTS idx_public_lists_view_count ON public_favorite_lists(view_count DESC);
CREATE INDEX IF NOT EXISTS idx_public_lists_created ON public_favorite_lists(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_public_list_items_list ON public_favorite_list_items(list_id);
CREATE INDEX IF NOT EXISTS idx_public_list_items_item ON public_favorite_list_items(item_type, item_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_public_list_items_unique ON public_favorite_list_items(list_id, item_type, item_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_public_list_likes_unique ON public_favorite_list_likes(list_id, user_id);

-- ============================================
-- 情報修正提案機能
-- ============================================

-- ユーザーによる情報修正提案テーブル
CREATE TABLE IF NOT EXISTS user_corrections (
    id SERIAL PRIMARY KEY,
    target_type VARCHAR(50) NOT NULL,  -- 'product', 'performer'
    target_id INTEGER NOT NULL,
    user_id VARCHAR(255) NOT NULL,  -- Firebase UID
    field_name VARCHAR(100) NOT NULL,  -- 修正対象フィールド名
    current_value TEXT,  -- 現在の値
    suggested_value TEXT NOT NULL,  -- 提案する値
    reason TEXT,  -- 修正理由
    status VARCHAR(50) DEFAULT 'pending',  -- pending, approved, rejected
    reviewed_by VARCHAR(255),  -- 審査者
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- インデックス（修正提案）
CREATE INDEX IF NOT EXISTS idx_corrections_target ON user_corrections(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_corrections_user ON user_corrections(user_id);
CREATE INDEX IF NOT EXISTS idx_corrections_status ON user_corrections(status);
CREATE INDEX IF NOT EXISTS idx_corrections_created ON user_corrections(created_at DESC);

-- ============================================
-- ユーザー貢献度テーブル
-- ============================================

-- ユーザー貢献度サマリー
CREATE TABLE IF NOT EXISTS user_contribution_stats (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL UNIQUE,  -- Firebase UID
    display_name VARCHAR(100),
    review_count INTEGER DEFAULT 0,
    tag_suggestion_count INTEGER DEFAULT 0,
    tag_approved_count INTEGER DEFAULT 0,
    performer_suggestion_count INTEGER DEFAULT 0,
    performer_approved_count INTEGER DEFAULT 0,
    correction_count INTEGER DEFAULT 0,
    correction_approved_count INTEGER DEFAULT 0,
    public_list_count INTEGER DEFAULT 0,
    total_list_likes INTEGER DEFAULT 0,
    contribution_score INTEGER DEFAULT 0,  -- 総合貢献スコア
    badges JSONB DEFAULT '[]'::jsonb,  -- 獲得バッジ
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- インデックス（貢献度）
CREATE INDEX IF NOT EXISTS idx_contribution_stats_user ON user_contribution_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_contribution_stats_score ON user_contribution_stats(contribution_score DESC);
