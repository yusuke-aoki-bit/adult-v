-- 商品同一性マッチング強化マイグレーション
-- 品番、女優、タイトル曖昧検索による同一商品判定

-- pg_trgm拡張が有効になっているか確認（既に有効の場合はスキップ）
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 既存テーブルへのカラム追加
-- product_identity_groups に正規化品番を追加
ALTER TABLE product_identity_groups ADD COLUMN IF NOT EXISTS
  canonical_product_code VARCHAR(50);

-- product_identity_group_members に ASP名を追加
ALTER TABLE product_identity_group_members ADD COLUMN IF NOT EXISTS
  asp_name VARCHAR(50);

-- products テーブルに正規化タイトル列を追加（類似検索用）
-- GENERATED ALWAYS AS ... STORED は PostgreSQL 12+ で使用可能
-- 空白・句読点を除去して小文字化
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'normalized_title'
  ) THEN
    ALTER TABLE products ADD COLUMN normalized_title TEXT;

    -- 既存データを更新
    UPDATE products SET normalized_title = lower(regexp_replace(title, '[[:space:][:punct:]]', '', 'g'));

    -- 今後の挿入・更新用にトリガーを作成
    CREATE OR REPLACE FUNCTION update_normalized_title()
    RETURNS TRIGGER AS $func$
    BEGIN
      NEW.normalized_title := lower(regexp_replace(NEW.title, '[[:space:][:punct:]]', '', 'g'));
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_update_normalized_title ON products;
    CREATE TRIGGER trg_update_normalized_title
      BEFORE INSERT OR UPDATE OF title ON products
      FOR EACH ROW
      EXECUTE FUNCTION update_normalized_title();
  END IF;
END $$;

-- インデックス作成

-- 正規化タイトル用のGINインデックス（pg_trgm類似検索用）
CREATE INDEX IF NOT EXISTS idx_products_normalized_title_trgm
  ON products USING GIN (normalized_title gin_trgm_ops);

-- maker_product_code用のB-treeインデックス（NULL以外のみ）
CREATE INDEX IF NOT EXISTS idx_products_maker_code_btree
  ON products (maker_product_code) WHERE maker_product_code IS NOT NULL;

-- 正規化品番による同一性グループ検索用インデックス
CREATE INDEX IF NOT EXISTS idx_identity_groups_canonical_code
  ON product_identity_groups(canonical_product_code) WHERE canonical_product_code IS NOT NULL;

-- ASP名による検索用インデックス
CREATE INDEX IF NOT EXISTS idx_identity_members_asp_name
  ON product_identity_group_members(asp_name) WHERE asp_name IS NOT NULL;

-- コメント追加
COMMENT ON COLUMN product_identity_groups.canonical_product_code IS '正規化品番 (例: SSIS-865)';
COMMENT ON COLUMN product_identity_group_members.asp_name IS 'ASP名 (FANZA, MGS, DUGA等)';
COMMENT ON COLUMN products.normalized_title IS '正規化タイトル（空白・句読点除去、小文字化）- pg_trgm類似検索用';
