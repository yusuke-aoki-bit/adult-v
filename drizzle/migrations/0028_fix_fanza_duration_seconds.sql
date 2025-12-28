-- Fix FANZA products with duration stored in seconds instead of minutes
-- Duration values > 600 are likely seconds (max realistic video duration is ~600 minutes = 10 hours)
-- This migration converts those values from seconds to minutes

-- Step 1: Fix existing FANZA products where duration appears to be in seconds
-- A duration > 600 is almost certainly stored in seconds (normal videos are 60-180 min)
UPDATE products
SET duration = ROUND(duration::numeric / 60)
WHERE normalized_product_id LIKE 'FANZA-%'
  AND duration > 600;

-- Step 2: Verify the fix - show distribution after update
-- SELECT
--   CASE
--     WHEN duration < 60 THEN 'under_60_min'
--     WHEN duration < 180 THEN '60-180_min'
--     WHEN duration < 600 THEN '180-600_min'
--     ELSE 'over_600_min'
--   END as range,
--   COUNT(*) as count
-- FROM products
-- WHERE normalized_product_id LIKE 'FANZA-%'
--   AND duration IS NOT NULL
-- GROUP BY 1
-- ORDER BY 1;
