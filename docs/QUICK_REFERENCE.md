# クイックリファレンス

開発でよく使う情報をまとめたクイックリファレンスです。

## 環境変数

### データベース

```bash
# 本番DB
DATABASE_URL='postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres'

# URL エンコード版 (bash で ! が問題になる場合)
DATABASE_URL='postgresql://adult-v:AdultV2024%21Secure@34.27.234.120:5432/postgres'
```

### API Keys

```bash
# DUGA (APEX)
DUGA_APP_ID=WzsUOEt2124UD65BqsHU
DUGA_AGENT_ID=48611-01
DUGA_BANNER_ID=01

# Sokmil
SOKMIL_API_KEY=70c75ce3a36c1f503f2515ff094d6f60

# MGS (未取得)
MGS_API_KEY=xxxxx

# DMM (未使用 - DTI Servicesと排他のため)
DMM_API_ID=xxxxx
DMM_AFFILIATE_ID=xxxxx
```

## GCP 情報

```bash
PROJECT_ID=adult-v-446607
REGION=asia-northeast1
LOCATION=asia-northeast1
SERVICE_ACCOUNT=646431984228-compute@developer.gserviceaccount.com
```

## よく使うコマンド

### 開発サーバー

```bash
cd "C:\Users\yuuku\cursor\adult-v"
DATABASE_URL='postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres' npm run dev
```

### マイグレーション実行

```bash
# 最新マイグレーション実行
DATABASE_URL='postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres' npx tsx scripts/run-migration-XXXX.ts
```

### データベース直接アクセス

```bash
PGPASSWORD='AdultV2024!Secure' psql -h 34.27.234.120 -U adult-v -d postgres

# クエリ実行
PGPASSWORD='AdultV2024!Secure' psql -h 34.27.234.120 -U adult-v -d postgres -c "SELECT COUNT(*) FROM products;"
```

### Cloud Scheduler

```bash
# 全スケジューラーセットアップ
bash scripts/setup-all-schedulers.sh

# スケジューラー一覧
gcloud scheduler jobs list --location=asia-northeast1

# 特定ジョブを一時停止
gcloud scheduler jobs pause duga-parallel-0 --location=asia-northeast1

# 特定ジョブを再開
gcloud scheduler jobs resume duga-parallel-0 --location=asia-northeast1
```

### Cloud Run Jobs

```bash
# ジョブ一覧
gcloud run jobs list --region=asia-northeast1

# ジョブ実行
gcloud run jobs execute duga-crawler --region=asia-northeast1

# ジョブ実行履歴
gcloud run jobs executions list --region=asia-northeast1

# ログ確認
gcloud logging read "resource.type=cloud_run_job AND resource.labels.job_name=duga-crawler" --limit 50
```

### Docker ビルド & デプロイ

```bash
# DUGAクローラー
gcloud builds submit --config cloudbuild-duga.yaml .

# MGSクローラー
gcloud builds submit --config cloudbuild-mgs.yaml .

# 一括デプロイ
bash scripts/deploy-crawler-jobs.sh
```

## スクリプト実行

### クローラー実行

```bash
# DUGAクローラー (ローカル)
DATABASE_URL='postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres' \
  npx tsx scripts/crawlers/crawl-duga.ts --limit 100

# DUGA画像クローラー
DATABASE_URL='postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres' \
  npx tsx scripts/crawlers/crawl-duga-images.ts --limit 100 --offset 0

# MGSクローラー
DATABASE_URL='postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres' \
  npx tsx scripts/crawlers/crawl-mgs.ts "https://www.mgstage.com/product/product_detail/300MAAN-1028/"
```

### データ診断・修復

```bash
# DUGA商品データ診断
DATABASE_URL='postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres' \
  npx tsx scripts/diagnose-duga-data.ts

# DUGA商品sources復元
DATABASE_URL='postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres' \
  npx tsx scripts/backfill-duga-sources.ts

# raw_html から画像復元
DATABASE_URL='postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres' \
  npx tsx scripts/backfill-images-from-raw-html.ts 50 100

# 出演者重複排除
DATABASE_URL='postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres' \
  npx tsx scripts/merge-performer-aliases.ts
```

## データベース クエリ

### 商品統計

```sql
-- DUGA商品数
SELECT COUNT(*) FROM products WHERE normalized_product_id LIKE 'alpha-%';

-- ASP別商品数
SELECT asp_name, COUNT(*)
FROM product_sources
GROUP BY asp_name
ORDER BY COUNT(*) DESC;

-- サムネイルあり/なし
SELECT
  COUNT(*) as total,
  COUNT(default_thumbnail_url) as with_thumb,
  COUNT(*) - COUNT(default_thumbnail_url) as without_thumb
FROM products;
```

### 画像統計

```sql
-- ASP別画像数
SELECT asp_name, COUNT(*)
FROM product_images
GROUP BY asp_name
ORDER BY COUNT(*) DESC;

-- 画像タイプ別集計
SELECT image_type, COUNT(*)
FROM product_images
GROUP BY image_type;
```

### 出演者統計

```sql
-- 出演者総数
SELECT COUNT(*) FROM performers;

-- 画像あり出演者数
SELECT COUNT(*) FROM performers WHERE image_url IS NOT NULL;

-- 作品数順TOP10
SELECT p.name, COUNT(pp.product_id) as product_count
FROM performers p
JOIN product_performers pp ON p.id = pp.performer_id
GROUP BY p.id, p.name
ORDER BY product_count DESC
LIMIT 10;
```

## 重要な制約事項

### ⚠️ DMM と DTI Services の排他制限

**同一サイト上で DMMアフィリエイト と DTI Services のコンテンツを同時に掲載することは禁止されています。**

現在の実装:
- ✅ DTI Services (一本道、カリビアンコム等) のみ掲載
- ❌ DMM (FANZA) は未実装・未掲載

もしDMMを掲載したい場合は、DTI Servicesのすべてのコンテンツを削除する必要があります。

### クレジット表示義務

すべてのASPでクレジット表示が必要です:

- **DUGA**: 「このサイトはDUGA Webサービスを利用しています」
- **Sokmil**: 「提供: ソクミル」または「Powered by Sokmil」
- **DTI Services**: 各サービス名の表示
- **DMM**: 「DMM.com」または「FANZA」のロゴ表示

## ディレクトリ構造

```
adult-v/
├── app/                    # Next.js App Router
│   ├── [locale]/          # 多言語対応ページ
│   │   ├── products/      # 商品一覧・詳細
│   │   ├── performers/    # 出演者一覧・詳細
│   │   └── ...
│   └── api/               # APIルート
├── lib/                    # 共通ライブラリ
│   ├── db.ts              # データベース接続
│   └── ...
├── scripts/                # バッチスクリプト
│   ├── crawlers/          # クローラー
│   └── ...
├── drizzle/                # Drizzle ORM
│   ├── migrations/        # マイグレーションSQL
│   └── schema.ts          # スキーマ定義
├── docs/                   # ドキュメント
│   ├── API_REFERENCE.md   # API詳細リファレンス
│   └── QUICK_REFERENCE.md # このファイル
└── ...
```

## トラブルシューティング

### 1. "column does not exist" エラー

マイグレーションが実行されていない可能性があります。

```bash
# 最新マイグレーションを実行
cd drizzle/migrations
ls -lt *.sql | head -1  # 最新ファイルを確認
DATABASE_URL='...' npx tsx scripts/run-migration-XXXX.ts
```

### 2. "relation does not exist" エラー

テーブルが存在しません。マイグレーションを順番に実行してください。

```bash
# SQLファイルを直接実行
PGPASSWORD='AdultV2024!Secure' psql -h 34.27.234.120 -U adult-v -d postgres \
  -f drizzle/migrations/XXXX_name.sql
```

### 3. レート制限エラー

APIのレート制限に引っかかった場合:

- **DUGA**: 60秒待機
- **Sokmil**: エラーレスポンスに従って待機
- Cloud Schedulerの実行間隔を広げる

### 4. Cloud Run Jobがタイムアウト

```bash
# タイムアウト時間を延長 (最大3600秒)
gcloud run jobs update duga-crawler \
  --region=asia-northeast1 \
  --task-timeout=1800s
```

### 5. メモリ不足エラー

```bash
# メモリを増やす
gcloud run jobs update duga-crawler \
  --region=asia-northeast1 \
  --memory=2Gi
```

## 参考リンク

- [API詳細リファレンス](./API_REFERENCE.md)
- [DUGA API ドキュメント](https://duga.jp/aff/member/webservice/)
- [Sokmil API ドキュメント](https://sokmil-ad.com/member/api)
- [Next.js ドキュメント](https://nextjs.org/docs)
- [Drizzle ORM ドキュメント](https://orm.drizzle.team/)
- [Google Cloud Run ドキュメント](https://cloud.google.com/run/docs)

---

最終更新: 2025-01-26
