# Cloud Scheduler セットアップガイド

## 概要

このドキュメントでは、adult-vプロジェクトのクローラーをGoogle Cloud Schedulerで定期実行するための設定手順を説明します。

## 作成されたAPIエンドポイント

### クローラーエンドポイント

| エンドポイント | 説明 | 推奨スケジュール |
|---|---|---|
| `/api/cron/crawl-b10f` | b10f.jp CSVクローラー | 毎日 6:00 JST |
| `/api/cron/crawl-duga` | DUGA APIクローラー | 毎日 7:00 JST |
| `/api/cron/crawl-sokmil` | Sokmil APIクローラー | 毎日 8:00 JST |
| `/api/cron/process-raw-data` | 未処理HTMLデータ処理 | 毎時 */30分 |
| `/api/cron/status` | ステータス確認 | 必要に応じて |

### クエリパラメータ

各クローラーは以下のクエリパラメータをサポートします：

- `limit`: 処理件数の上限（デフォルト: 100-500）
- `offset`: 開始位置（該当するエンドポイントのみ）
- `page`: ページ番号（Sokmilのみ）
- `source`: 処理するソース（process-raw-dataのみ）

例: `/api/cron/crawl-b10f?limit=1000`

## 認証

### 認証方法

エンドポイントは以下の認証方法をサポートします：

1. **Cloud Scheduler OIDC（推奨）**
   - Cloud Schedulerが自動でOIDCトークンを付与
   - `Authorization: Bearer <token>` ヘッダー

2. **シークレットキー（開発/テスト用）**
   - `X-Cron-Secret: <secret>` ヘッダー
   - またはクエリパラメータ `?secret=<secret>`

### 環境変数

```bash
# .env.local
CRON_SECRET=your-secure-secret-key
```

## Cloud Scheduler 設定手順

### 1. GCPプロジェクトでCloud Schedulerを有効化

```bash
gcloud services enable cloudscheduler.googleapis.com
```

### 2. サービスアカウント作成（OIDC認証用）

```bash
# サービスアカウント作成
gcloud iam service-accounts create crawler-scheduler \
  --display-name="Crawler Scheduler"

# Cloud Runへのアクセス権限付与
gcloud run services add-iam-policy-binding adult-v \
  --member="serviceAccount:crawler-scheduler@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.invoker" \
  --region=asia-northeast1
```

### 3. Cloud Scheduler ジョブ作成

#### b10f クローラー（毎日6:00 JST）

```bash
gcloud scheduler jobs create http crawl-b10f \
  --location=asia-northeast1 \
  --schedule="0 6 * * *" \
  --time-zone="Asia/Tokyo" \
  --uri="https://your-domain.com/api/cron/crawl-b10f?limit=500" \
  --http-method=GET \
  --oidc-service-account-email="crawler-scheduler@PROJECT_ID.iam.gserviceaccount.com" \
  --attempt-deadline=600s
```

#### DUGA クローラー（毎日7:00 JST）

```bash
gcloud scheduler jobs create http crawl-duga \
  --location=asia-northeast1 \
  --schedule="0 7 * * *" \
  --time-zone="Asia/Tokyo" \
  --uri="https://your-domain.com/api/cron/crawl-duga?limit=100" \
  --http-method=GET \
  --oidc-service-account-email="crawler-scheduler@PROJECT_ID.iam.gserviceaccount.com" \
  --attempt-deadline=600s
```

#### Sokmil クローラー（毎日8:00 JST）

```bash
gcloud scheduler jobs create http crawl-sokmil \
  --location=asia-northeast1 \
  --schedule="0 8 * * *" \
  --time-zone="Asia/Tokyo" \
  --uri="https://your-domain.com/api/cron/crawl-sokmil?limit=100" \
  --http-method=GET \
  --oidc-service-account-email="crawler-scheduler@PROJECT_ID.iam.gserviceaccount.com" \
  --attempt-deadline=600s
```

#### Raw Data 処理（30分ごと）

```bash
gcloud scheduler jobs create http process-raw-data \
  --location=asia-northeast1 \
  --schedule="*/30 * * * *" \
  --time-zone="Asia/Tokyo" \
  --uri="https://your-domain.com/api/cron/process-raw-data?limit=500" \
  --http-method=GET \
  --oidc-service-account-email="crawler-scheduler@PROJECT_ID.iam.gserviceaccount.com" \
  --attempt-deadline=600s
```

### 4. ジョブの手動実行（テスト）

```bash
gcloud scheduler jobs run crawl-b10f --location=asia-northeast1
```

### 5. ジョブの一覧確認

```bash
gcloud scheduler jobs list --location=asia-northeast1
```

## ローカルテスト

```bash
# シークレットキーを使用してテスト
curl -H "X-Cron-Secret: dev-cron-secret-key" \
  "http://localhost:3000/api/cron/crawl-b10f?limit=10"

# ステータス確認
curl -H "X-Cron-Secret: dev-cron-secret-key" \
  "http://localhost:3000/api/cron/status"
```

## レスポンス形式

成功時:
```json
{
  "success": true,
  "message": "b10f crawl completed",
  "stats": {
    "totalFetched": 500,
    "newProducts": 120,
    "updatedProducts": 380,
    "errors": 0,
    "rawDataSaved": 1,
    "videosAdded": 450
  },
  "duration": "45s"
}
```

エラー時:
```json
{
  "success": false,
  "error": "Error message",
  "stats": { ... }
}
```

## 注意事項

1. **タイムアウト**: 各エンドポイントは最大5分（300秒）のタイムアウト設定
2. **同時実行**: 同じエンドポイントの同時実行は避ける
3. **エラーハンドリング**: 個別の商品処理エラーは全体を中断せず、statsに記録される
4. **レート制限**: 外部APIのレート制限に注意

## トラブルシューティング

### 認証エラー (401)

- OIDC設定を確認
- シークレットキーが正しいか確認
- Cloud Runのアクセス権限を確認

### タイムアウト

- `limit`パラメータを減らす
- Cloud Schedulerの`attempt-deadline`を延長

### メモリエラー

- `limit`を減らして処理件数を制限
