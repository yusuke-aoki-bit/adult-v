-- product_images テーブルに (product_id, image_url) のユニーク制約を追加
-- これにより ON CONFLICT (product_id, image_url) DO NOTHING が動作するようになる

-- まず重複データを削除（古いものを残す）
DELETE FROM product_images a
USING product_images b
WHERE a.id > b.id
  AND a.product_id = b.product_id
  AND a.image_url = b.image_url;

-- ユニークインデックスを追加
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_images_unique
ON product_images (product_id, image_url);
