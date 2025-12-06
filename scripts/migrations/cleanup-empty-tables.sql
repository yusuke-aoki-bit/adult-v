-- データベース整理: 空のテーブルを削除
-- 実行前に必ずバックアップを取ること!

-- product_images テーブルを削除 (0件)
DROP TABLE IF EXISTS product_images CASCADE;

-- product_videos テーブルを削除 (0件)
DROP TABLE IF EXISTS product_videos CASCADE;

-- performer_images テーブルを削除 (0件)
DROP TABLE IF EXISTS performer_images CASCADE;

-- 削除後の確認
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
