-- Delete duplicate video entries keeping only the one with min id for each (product_id, video_url) pair
DELETE FROM product_videos
WHERE id NOT IN (
  SELECT MIN(id)
  FROM product_videos
  GROUP BY product_id, video_url
);

-- Add unique constraint to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_videos_unique ON product_videos (product_id, video_url);
