# 女優名寄せシステム実装ドキュメント

## 概要

av-wikiやnakinyの女優名と作品情報を活用して、同一人物を判断する拡張版名寄せシステムを実装しました。

## システム構成

### 1. 別名自動生成 ([generate-performer-aliases.ts](../scripts/generate-performer-aliases.ts))

既存の女優名から以下のバリエーションを自動生成します:

#### 生成ルール

1. **全角/半角変換**
   - `ABC123` → `ＡＢＣ１２３`
   - `ＡＢＣ１２３` → `ABC123`

2. **ひらがな/カタカナ変換**
   - `あいうえお` → `アイウエオ`
   - `アイウエオ` → `あいうえお`

3. **スペースバリエーション**
   - `山田 太郎` → `山田太郎`
   - `やまだたろう` → `やまだ たろう`

4. **組み合わせ**
   - 上記の変換を組み合わせて適用

#### 使い方

```bash
# 全女優の別名を自動生成
DATABASE_URL="..." npx tsx scripts/generate-performer-aliases.ts
```

#### 出力例

```
対象女優数: 37938
生成した別名: 15234件
スキップ: 8721件

別名データソース別統計:
┌─────────┬─────────────────┬─────────┐
│ (index) │ source          │ count   │
├─────────┼─────────────────┼─────────┤
│ 0       │ 'initial'       │ '27390' │
│ 1       │ 'auto_generated'│ '15234' │
│ 2       │ 'av-wiki'       │ '2150'  │
│ 3       │ 'nakiny'        │ '890'   │
└─────────┴─────────────────┴─────────┘
```

### 2. 拡張版名寄せ ([merge-performer-aliases-enhanced.ts](../scripts/merge-performer-aliases-enhanced.ts))

4つのマッチング手法を組み合わせて、同一人物を検出します:

#### マッチング手法

##### 2.1 別名ベースマッチング (既存)
- `performer_aliases`テーブルに登録された別名を使用
- 信頼度: **90%**

##### 2.2 完全一致マッチング (既存)
- 文字列正規化後に完全一致
- 信頼度: **100%**

##### 2.3 作品共起マッチング (新規実装) 🆕
```sql
-- 同じ作品に出演している女優ペアを検出
SELECT
  pp1.performer_id as performer1_id,
  p1.name as performer1_name,
  pp2.performer_id as performer2_id,
  p2.name as performer2_name,
  COUNT(DISTINCT pp1.product_id) as common_products
FROM product_performers pp1
JOIN product_performers pp2 ON pp1.product_id = pp2.product_id
JOIN performers p1 ON pp1.performer_id = p1.id
JOIN performers p2 ON pp2.performer_id = p2.id
WHERE pp1.performer_id < pp2.performer_id
GROUP BY pp1.performer_id, p1.name, pp2.performer_id, p2.name
HAVING COUNT(DISTINCT pp1.product_id) >= 3
```

**信頼度計算**:
- 名前類似度 × 50% + 共通作品数 × 5%
- 例: 類似度80% + 5作品 = 65%

##### 2.4 外部ソースクロスマッチング (新規実装) 🆕
```typescript
// av-wiki/nakinyから取得した別名を使用
// 例: av-wikiに「明日花キララ」の別名「Asuka」が登録
//     → DBに「Asuka」という別の女優がいる
//     → 両者が同じ作品に出演していれば同一人物
```

**信頼度計算**:
- 外部ソース別名マッチ: 60%
- + 共通作品1件につき +3% (最大15%)
- 例: av-wiki別名 + 3作品 = 69%

#### 使い方

```bash
# DRY RUN (確認のみ)
DATABASE_URL="..." npx tsx scripts/merge-performer-aliases-enhanced.ts

# 実行 (信頼度80%以上をマージ)
DATABASE_URL="..." npx tsx scripts/merge-performer-aliases-enhanced.ts \
  --execute --min-confidence=80

# 実行 (信頼度60%以上をマージ)
DATABASE_URL="..." npx tsx scripts/merge-performer-aliases-enhanced.ts \
  --execute --min-confidence=60
```

#### 出力例

```
=== 拡張版女優名寄せ（作品情報活用） ===

📊 Total merge candidates: 1523

=== Merge Plan (sorted by confidence) ===

🟢 High Confidence (892):
  [work_cooccurrence] "山田 花子" → "山田花子" (85%, 7 common products, similarity: 100%)
  [cross_source] "Asuka Kirara" → "明日花キララ" (87%, av-wiki alias "Asuka", 5 common products)
  [exact_match] "鈴木里奈 " → "鈴木里奈" (100%)
  [alias] "椎名なな美" → "椎名ななみ" (90%)
  ... and 888 more

🟡 Medium Confidence (421):
  [work_cooccurrence] "田中 美咲" → "田中みさき" (72%, 4 common products, similarity: 80%)
  [cross_source] "Yui Hatano" → "波多野結衣" (66%, nakiny alias, 2 common products)
  ... and 419 more

🟠 Low Confidence (210):
  [work_cooccurrence] "佐藤さん" → "佐藤 さん" (55%, 3 common products, similarity: 100%)
  ... and 209 more

⚠️  This is a DRY RUN. Run with --execute flag to apply changes.
```

### 3. 別名統計確認 ([check-alias-stats.ts](../scripts/check-alias-stats.ts))

現在の別名データの状況を確認します。

#### 使い方

```bash
DATABASE_URL="..." npx tsx scripts/check-alias-stats.ts
```

#### 出力例

```
=== 別名データソース別統計 ===

データソース別:
┌─────────┬─────────────────┬─────────────┬───────────────────┐
│ (index) │ source          │ alias_count │ unique_performers │
├─────────┼─────────────────┼─────────────┼───────────────────┤
│ 0       │ 'initial'       │ '27390'     │ '27390'           │
│ 1       │ 'auto_generated'│ '15234'     │ '12450'           │
│ 2       │ 'av-wiki'       │ '2150'      │ '1890'            │
│ 3       │ 'nakiny'        │ '890'       │ '780'             │
└─────────┴─────────────────┴─────────────┴───────────────────┘

全体サマリー:
┌─────────┬──────────────────┬───────────────┬─────────────────────────┐
│ (index) │ total_performers │ total_aliases │ performers_with_aliases │
├─────────┼──────────────────┼───────────────┼─────────────────────────┤
│ 0       │ '37938'          │ '45664'       │ '34210'                 │
└─────────┴──────────────────┴───────────────┴─────────────────────────┘

別名が多い女優 TOP10:
  明日花キララ (15件)
    → Asuka Kirara, あすかきらら, アスカキララ, 明日花 キララ, asuka...
  波多野結衣 (12件)
    → Yui Hatano, はたのゆい, ハタノユイ, 波多野 結衣...
```

## データベーススキーマ

### performer_aliases テーブル

```sql
CREATE TABLE performer_aliases (
  id SERIAL PRIMARY KEY,
  performer_id INTEGER NOT NULL REFERENCES performers(id) ON DELETE CASCADE,
  alias_name VARCHAR(200) NOT NULL,
  source VARCHAR(100), -- 'av-wiki', 'nakiny', 'auto_generated', 'initial'
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (performer_id, alias_name)
);

CREATE INDEX idx_aliases_performer ON performer_aliases(performer_id);
CREATE INDEX idx_aliases_name ON performer_aliases(alias_name);
```

### product_performers テーブル (作品共起用)

```sql
CREATE TABLE product_performers (
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  performer_id INTEGER NOT NULL REFERENCES performers(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, performer_id)
);

CREATE INDEX idx_pp_product ON product_performers(product_id);
CREATE INDEX idx_pp_performer ON product_performers(performer_id);
```

## 運用フロー

### 1. 別名収集

```bash
# 1. 既存の女優名から自動生成
npx tsx scripts/generate-performer-aliases.ts

# 2. av-wikiから収集 (今後実装予定)
npx tsx scripts/crawlers/crawl-wiki-performers.ts av-wiki 1000

# 3. nakinyから収集 (今後実装予定)
npx tsx scripts/crawlers/crawl-nakiny.ts
```

### 2. 名寄せ実行

```bash
# 1. DRY RUNで確認
npx tsx scripts/merge-performer-aliases-enhanced.ts

# 2. 高信頼度のみマージ (推奨)
npx tsx scripts/merge-performer-aliases-enhanced.ts --execute --min-confidence=80

# 3. 結果確認
npx tsx scripts/check-alias-stats.ts
```

### 3. 定期実行 (Cloud Run)

```bash
# Cloud Run ジョブとしてデプロイ
gcloud run jobs create performer-dedup \
  --image gcr.io/adult-v/performer-dedup:latest \
  --region asia-northeast1 \
  --set-env-vars DATABASE_URL="..." \
  --args="--execute,--min-confidence=80"

# スケジュール設定 (毎日午前3時)
gcloud scheduler jobs create http dedup-daily \
  --location asia-northeast1 \
  --schedule="0 3 * * *" \
  --uri="https://asia-northeast1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/adult-v/jobs/performer-dedup:run" \
  --http-method POST \
  --oauth-service-account-email "..."
```

## パフォーマンス最適化

### インデックス

```sql
-- 作品共起検索を高速化
CREATE INDEX idx_pp_product ON product_performers(product_id);
CREATE INDEX idx_pp_performer ON product_performers(performer_id);

-- 別名検索を高速化
CREATE INDEX idx_aliases_name ON performer_aliases(alias_name);
CREATE INDEX idx_aliases_performer ON performer_aliases(performer_id);
```

### バッチ処理

大量のデータを処理する場合は、バッチサイズを調整:

```typescript
// 1000件ずつ処理
for (let offset = 0; offset < totalPerformers; offset += 1000) {
  const batch = await db.select()
    .from(performers)
    .limit(1000)
    .offset(offset);

  await processB Atch(batch);
}
```

## トラブルシューティング

### 1. メモリ不足

```bash
# Node.jsのメモリ上限を増やす
NODE_OPTIONS="--max-old-space-size=4096" npx tsx scripts/...
```

### 2. データベース接続タイムアウト

```typescript
// タイムアウトを延長
const db = getDb({
  connectionTimeoutMillis: 30000,
});
```

### 3. 誤マージの修正

```sql
-- マージを取り消す (手動)
-- 1. 誤ってマージされた女優を復元
INSERT INTO performers (name, ...) VALUES ('誤マージされた名前', ...);

-- 2. 作品リレーションを修正
UPDATE product_performers
SET performer_id = [新しいID]
WHERE performer_id = [古いID]
AND product_id IN ([対象作品ID]);
```

## 今後の拡張

### 1. 画像ベースマッチング
- 女優の顔画像を比較して同一人物を判定
- 深層学習モデル (FaceNet等) を使用

### 2. テキスト類似度
- プロフィール文の類似度を計算
- TF-IDF, コサイン類似度

### 3. 外部API連携
- DMM APIの女優情報
- Wikipediaの女優情報

## 参照

- [別名自動生成スクリプト](../scripts/generate-performer-aliases.ts)
- [拡張版名寄せスクリプト](../scripts/merge-performer-aliases-enhanced.ts)
- [別名統計確認スクリプト](../scripts/check-alias-stats.ts)
- [データベーススキーマ](../lib/db/schema.ts)
