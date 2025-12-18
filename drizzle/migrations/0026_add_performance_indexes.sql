-- パフォーマンス最適化のための追加インデックスとカラム (2024-12)
-- getActresses, getProducts の遅延改善用

-- ==============================================================
-- PART 1: 事前計算カラムの追加（JOINを削減）
-- ==============================================================

-- performers テーブルに事前計算カラムを追加
ALTER TABLE performers ADD COLUMN IF NOT EXISTS is_fanza_only BOOLEAN DEFAULT FALSE;
ALTER TABLE performers ADD COLUMN IF NOT EXISTS latest_release_date DATE;
ALTER TABLE performers ADD COLUMN IF NOT EXISTS release_count INTEGER DEFAULT 0;

-- ==============================================================
-- PART 2: 事前計算データの更新
-- ==============================================================

-- is_fanza_only フラグを更新
-- FANZA作品のみに出演している女優をマーク
UPDATE performers p
SET is_fanza_only = TRUE
WHERE EXISTS (
  SELECT 1 FROM product_performers pp
  INNER JOIN product_sources ps ON pp.product_id = ps.product_id
  WHERE pp.performer_id = p.id
  AND ps.asp_name = 'FANZA'
)
AND NOT EXISTS (
  SELECT 1 FROM product_performers pp
  INNER JOIN product_sources ps ON pp.product_id = ps.product_id
  WHERE pp.performer_id = p.id
  AND ps.asp_name != 'FANZA'
);

-- latest_release_date と release_count を更新
UPDATE performers p
SET
  latest_release_date = sub.latest_date,
  release_count = sub.cnt
FROM (
  SELECT
    pp.performer_id,
    MAX(pr.release_date) as latest_date,
    COUNT(DISTINCT pp.product_id) as cnt
  FROM product_performers pp
  INNER JOIN products pr ON pp.product_id = pr.id
  GROUP BY pp.performer_id
) sub
WHERE p.id = sub.performer_id;

-- ==============================================================
-- PART 3: インデックスの追加
-- ==============================================================

-- 1. performers.is_fanza_only のインデックス
-- FANZA専用チェックで頻繁に使用される
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_performers_is_fanza_only
ON performers(is_fanza_only) WHERE is_fanza_only = FALSE OR is_fanza_only IS NULL;

-- 2. performers.name_kana のインデックス（ソート用）
-- 名前順ソートでCOALESCEを使用しているため
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_performers_name_kana_sort
ON performers(COALESCE(name_kana, 'ん'));

-- 3. products.release_date + normalized_product_id の複合インデックス
-- 新着順ソートで頻繁に使用（安定ソート用）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_release_normalized
ON products(release_date DESC NULLS LAST, normalized_product_id DESC);

-- 4. product_sources のカバーリングインデックス
-- FANZA専用チェック（NOT EXISTS）で使用される
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sources_asp_product_covering
ON product_sources(asp_name, product_id) INCLUDE (id);

-- 5. product_performers + products のJOIN用インデックス
-- getActresses recent sortで3テーブルJOINを高速化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pp_performer_product
ON product_performers(performer_id, product_id);

-- 6. product_images.product_id のインデックス（カバーリング）
-- hasImageフィルタでEXISTSに使用
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_images_product_covering
ON product_images(product_id) INCLUDE (id);

-- 7. product_videos.product_id のインデックス（カバーリング）
-- hasVideoフィルタでEXISTSに使用
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_videos_product_covering
ON product_videos(product_id) INCLUDE (id);

-- 8. product_sales のアクティブセールインデックス
-- onSaleフィルタで使用
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_sales_active
ON product_sales(product_source_id, is_active, end_at)
WHERE is_active = TRUE;

-- 9. performers.ai_review の部分インデックス
-- hasReviewフィルタで使用
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_performers_has_review
ON performers(id) WHERE ai_review IS NOT NULL;

-- 10. product_performers のCOUNT高速化用インデックス
-- performerType solo/multi フィルタで使用
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pp_product_count
ON product_performers(product_id);

-- テーブル統計更新
ANALYZE performers;
ANALYZE products;
ANALYZE product_sources;
ANALYZE product_performers;
ANALYZE product_images;
ANALYZE product_videos;
ANALYZE product_sales;
