# データベース設計書

## 概要

PostgreSQL (Cloud SQL) を使用。ORM は Drizzle ORM。

## ERD

```
┌─────────────────┐     ┌──────────────────┐
│    products     │     │  product_sources │
├─────────────────┤     ├──────────────────┤
│ id (PK)         │◄────│ product_id (FK)  │
│ normalized_id   │     │ asp_name         │
│ maker_code      │     │ original_id      │
│ title           │     │ affiliate_url    │
│ release_date    │     │ price            │
│ description     │     └────────┬─────────┘
│ duration        │              │
│ ai_tags         │              ▼
└────────┬────────┘     ┌──────────────────┐
         │              │   product_sales  │
         │              ├──────────────────┤
         ▼              │ source_id (FK)   │
┌─────────────────┐     │ regular_price    │
│product_performers│     │ sale_price       │
├─────────────────┤     │ discount_percent │
│ product_id (FK) │     │ end_at           │
│ performer_id(FK)│     └──────────────────┘
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────────┐
│   performers    │     │ performer_aliases │
├─────────────────┤     ├──────────────────┤
│ id (PK)         │◄────│ performer_id(FK) │
│ name            │     │ alias_name       │
│ name_kana       │     │ source           │
│ bust/waist/hip  │     └──────────────────┘
│ is_fanza_only   │
└─────────────────┘

┌─────────────────┐     ┌──────────────────┐
│    products     │     │   product_tags   │
├─────────────────┤     ├──────────────────┤
│ id (PK)         │◄────│ product_id (FK)  │
└─────────────────┘     │ tag_id (FK)      │
                        └────────┬─────────┘
                                 │
                                 ▼
                        ┌──────────────────┐
                        │      tags        │
                        ├──────────────────┤
                        │ id (PK)          │
                        │ name             │
                        │ category         │
                        └──────────────────┘
```

## テーブル詳細

### products（商品マスタ）

名寄せ後の統合商品データ。

| カラム | 型 | 説明 |
|--------|-----|------|
| id | SERIAL | 主キー |
| normalized_product_id | VARCHAR(100) | 正規化済み品番（ユニーク） |
| maker_product_code | VARCHAR(50) | メーカー品番 |
| title | VARCHAR(500) | 商品タイトル |
| release_date | DATE | 発売日 |
| description | TEXT | 商品説明 |
| duration | INTEGER | 再生時間（分） |
| default_thumbnail_url | TEXT | サムネイルURL |
| title_en | VARCHAR(500) | 英語タイトル |
| title_zh | VARCHAR(500) | 中国語（簡体字）タイトル |
| ai_description | JSONB | AI生成説明 |
| ai_tags | JSONB | AI抽出タグ |
| ai_review | TEXT | AI生成レビュー |
| created_at | TIMESTAMP | 作成日時 |
| updated_at | TIMESTAMP | 更新日時 |

**インデックス**:
- `idx_products_normalized_id` (normalized_product_id)
- `idx_products_maker_code` (maker_product_code)
- `idx_products_release_date` (release_date)

### product_sources（ASP別商品情報）

各ASPの商品情報。同一商品でもASPごとに価格・URLが異なる。

| カラム | 型 | 説明 |
|--------|-----|------|
| id | SERIAL | 主キー |
| product_id | INTEGER | 商品ID（FK） |
| asp_name | VARCHAR(50) | ASP名 |
| original_product_id | VARCHAR(100) | ASP側の商品ID |
| affiliate_url | TEXT | アフィリエイトURL |
| price | INTEGER | 価格（円） |
| currency | VARCHAR(3) | 通貨（JPY/USD） |
| data_source | VARCHAR(10) | データソース（API/CSV） |

**インデックス**:
- `idx_sources_product_asp` (product_id, asp_name) UNIQUE
- `idx_sources_asp_original_id` (asp_name, original_product_id)

### product_sales（セール情報）

アクティブなセール・割引情報。

| カラム | 型 | 説明 |
|--------|-----|------|
| id | SERIAL | 主キー |
| product_source_id | INTEGER | 商品ソースID（FK） |
| regular_price | INTEGER | 通常価格 |
| sale_price | INTEGER | セール価格 |
| discount_percent | INTEGER | 割引率（%） |
| start_at | TIMESTAMP | セール開始日時 |
| end_at | TIMESTAMP | セール終了日時 |
| sale_name | VARCHAR(200) | セール名 |
| is_active | BOOLEAN | アクティブフラグ |

### performers（出演者マスタ）

出演者情報。複数の別名を持つ場合あり。

| カラム | 型 | 説明 |
|--------|-----|------|
| id | SERIAL | 主キー |
| name | VARCHAR(200) | 名前 |
| name_kana | VARCHAR(200) | 名前（カナ） |
| name_en | VARCHAR(200) | 英語名 |
| bust | INTEGER | バスト |
| waist | INTEGER | ウエスト |
| hip | INTEGER | ヒップ |
| height | INTEGER | 身長 |
| birth_date | DATE | 生年月日 |
| blood_type | VARCHAR(2) | 血液型 |
| profile_image_url | TEXT | プロフィール画像 |
| is_fanza_only | BOOLEAN | FANZA専用フラグ |

### tags（タグマスタ）

ジャンル、メーカー、シリーズなど。

| カラム | 型 | 説明 |
|--------|-----|------|
| id | SERIAL | 主キー |
| name | VARCHAR(200) | タグ名 |
| category | VARCHAR(50) | カテゴリ（genre/maker/series） |

## ASP一覧

| ASP名 | 説明 | データソース |
|-------|------|------------|
| FANZA | DMM FANZA | HTML Scraping |
| DUGA | DUGA/APEX | REST API |
| SOKMIL | ソクミル | REST API |
| MGS | MGS動画 | HTML Scraping |
| DTI系 | カリビアンコム等8サイト | HTML Scraping |
| FC2 | FC2コンテンツマーケット | HTML Scraping |
| TOKYOHOT | Tokyo Hot | HTML Scraping |
| B10F | 同人系 | CSV Import |

## クエリ例

### 商品取得（ASPフィルタ付き）

```sql
-- FANZA専用モード
SELECT p.* FROM products p
WHERE EXISTS (
  SELECT 1 FROM product_sources ps
  WHERE ps.product_id = p.id
  AND ps.asp_name = 'FANZA'
);

-- 全ASPモード（FANZA専用を除外）
SELECT p.* FROM products p
WHERE EXISTS (
  SELECT 1 FROM product_sources ps
  WHERE ps.product_id = p.id
  AND ps.asp_name != 'FANZA'
) OR NOT EXISTS (
  SELECT 1 FROM product_sources ps
  WHERE ps.product_id = p.id
  AND ps.asp_name = 'FANZA'
);
```

### 価格比較

```sql
SELECT
  ps.asp_name,
  ps.price,
  psl.sale_price,
  psl.discount_percent
FROM product_sources ps
LEFT JOIN product_sales psl ON ps.id = psl.product_source_id AND psl.is_active = TRUE
WHERE ps.product_id = ?
ORDER BY COALESCE(psl.sale_price, ps.price) ASC;
```

### 出演者の作品数

```sql
SELECT
  ps.asp_name,
  COUNT(DISTINCT pp.product_id) as count
FROM product_performers pp
INNER JOIN product_sources ps ON pp.product_id = ps.product_id
WHERE pp.performer_id = ?
GROUP BY ps.asp_name
ORDER BY count DESC;
```

## マイグレーション

Drizzle Kit を使用。

```bash
# マイグレーション生成
npx drizzle-kit generate

# マイグレーション適用
npx drizzle-kit push
```

## パフォーマンス考慮事項

1. **N+1問題**: `batchFetchProductRelatedData` で並列取得
2. **インデックス**: 頻出クエリパターンに対応
3. **キャッシュ**: `unstable_cache` + メモリキャッシュ
4. **接続プール**: Drizzle の Pool 設定
