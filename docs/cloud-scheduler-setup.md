# Cloud Scheduler セットアップガイド

## 概要

Cloud Schedulerから **Web App APIエンドポイント**（`/api/cron/*`）を直接呼び出す方式。
Cloud Run Jobsは使用せず、既存のWeb Appインスタンス上で処理することでコストを削減。

## アーキテクチャ

```
Cloud Scheduler → HTTPS GET/POST → Web App (Firebase App Hosting)
                  OIDC認証           /api/cron/{endpoint}
```

## セットアップ

### 1. 前提条件

```bash
# Cloud Scheduler API有効化
gcloud services enable cloudscheduler.googleapis.com

# サービスアカウントにCloud Run Invoker権限
gcloud run services add-iam-policy-binding adult-v \
  --member="serviceAccount:646431984228-compute@developer.gserviceaccount.com" \
  --role="roles/run.invoker" \
  --region=asia-northeast1
```

### 2. 全スケジューラー一括セットアップ

```bash
bash scripts/deploy/setup-all-schedulers.sh
```

### 3. 古いCloud Run Jobsスケジューラーの削除

```bash
bash scripts/deploy/cleanup-old-schedulers.sh
```

## スケジュール一覧

### クローラー（毎日）

| 時刻(JST) | ジョブ名                 | エンドポイント                            | 説明             |
| --------- | ------------------------ | ----------------------------------------- | ---------------- |
| 01:00     | crawl-dti-caribbeancom   | `/api/cron/crawl-dti?site=caribbeancom`   | カリビアンコム   |
| 01:10     | crawl-dti-caribbeancompr | `/api/cron/crawl-dti?site=caribbeancompr` | カリビアンコムPR |
| 01:20     | crawl-dti-1pondo         | `/api/cron/crawl-dti?site=1pondo`         | 一本道           |
| 01:30     | crawl-dti-heyzo          | `/api/cron/crawl-dti?site=heyzo`          | HEYZO            |
| 01:40     | crawl-dti-10musume       | `/api/cron/crawl-dti?site=10musume`       | 天然むすめ       |
| 01:50     | crawl-dti-pacopacomama   | `/api/cron/crawl-dti?site=pacopacomama`   | パコパコママ     |
| 03:00     | crawl-mgs-scheduler      | `/api/cron/crawl-mgs`                     | MGS              |
| 05:00     | crawl-duga-scheduler     | `/api/cron/crawl-duga`                    | DUGA             |
| 07:00     | crawl-sokmil-scheduler   | `/api/cron/crawl-sokmil`                  | SOKMIL           |
| 09:00     | crawl-japanska-scheduler | `/api/cron/crawl-japanska`                | Japanska         |
| 11:00     | crawl-b10f-scheduler     | `/api/cron/crawl-b10f`                    | b10f             |
| 13:00     | crawl-fc2-scheduler      | `/api/cron/crawl-fc2`                     | FC2              |

### エンリッチメント（毎日）

| 時刻(JST)      | ジョブ名                       | エンドポイント                          | タイムアウト |
| -------------- | ------------------------------ | --------------------------------------- | ------------ |
| 02,08,14,20:00 | process-raw-data-scheduler     | `/api/cron/process-raw-data`            | 5分          |
| 15:00          | performer-pipeline-scheduler   | `/api/cron/performer-pipeline`          | 30分         |
| 16:00          | content-enrichment-scheduler   | `/api/cron/content-enrichment-pipeline` | 5分          |
| 17:00          | normalize-performers-scheduler | `/api/cron/normalize-performers`        | 5分          |
| 18:00          | enhance-content-scheduler      | `/api/cron/enhance-content`             | 5分          |
| 19:00          | seo-enhance-scheduler          | `/api/cron/seo-enhance`                 | 5分          |

### バックフィル

| スケジュール     | ジョブ名                           | エンドポイント                          |
| ---------------- | ---------------------------------- | --------------------------------------- |
| 毎日 20:00       | backfill-videos-scheduler          | `/api/cron/backfill-videos`             |
| 毎日 21:00       | backfill-images-scheduler          | `/api/cron/backfill-images`             |
| 週1回 日曜 03:00 | backfill-performer-profiles-weekly | `/api/cron/backfill-performer-profiles` |
| 週1回 日曜 05:00 | backfill-reviews-weekly            | `/api/cron/backfill-reviews`            |
| 週1回 日曜 07:00 | crawl-performer-lookup-weekly      | `/api/cron/crawl-performer-lookup`      |

### メンテナンス・通知

| スケジュール     | ジョブ名                   | エンドポイント                  | メソッド |
| ---------------- | -------------------------- | ------------------------------- | -------- |
| 毎日 23:00       | cleanup-scheduler          | `/api/cron/cleanup`             | GET      |
| 3時間ごと        | indexnow-notify-scheduler  | `/api/cron/indexnow-notify`     | POST     |
| 週1回 月曜 04:00 | data-quality-report-weekly | `/api/cron/data-quality-report` | GET      |

## 認証

### OIDC認証（本番環境）

Cloud Schedulerが自動でOIDCトークンを生成し、`Authorization: Bearer <token>` ヘッダーを付与。
Web Appの `verifyCronRequest()` がBearerトークンの存在を確認。

### ヘッダー認証（開発環境）

```bash
curl -H "X-Cron-Secret: $CRON_SECRET" \
  "http://localhost:3000/api/cron/crawl-mgs?limit=10"
```

## 運用コマンド

```bash
# ジョブ一覧
gcloud scheduler jobs list --location=asia-northeast1

# 手動実行
gcloud scheduler jobs run crawl-mgs-scheduler --location=asia-northeast1

# 一時停止
gcloud scheduler jobs pause crawl-mgs-scheduler --location=asia-northeast1

# 再開
gcloud scheduler jobs resume crawl-mgs-scheduler --location=asia-northeast1

# ログ確認
gcloud logging read 'resource.type="cloud_scheduler_job"' --limit=20
```

## レスポンス形式

```json
{
  "success": true,
  "message": "crawl completed",
  "stats": {
    "totalFetched": 100,
    "newProducts": 20,
    "updatedProducts": 80,
    "errors": 0
  },
  "duration": "45s"
}
```

## トラブルシューティング

| 症状             | 原因            | 対処                                  |
| ---------------- | --------------- | ------------------------------------- |
| 401 Unauthorized | OIDC設定ミス    | サービスアカウント権限確認            |
| 504 Timeout      | 処理時間超過    | `limit`パラメータを減らす             |
| 500 Error        | DB接続エラー    | VPCコネクタ設定確認                   |
| ジョブがFAILED   | Web Appがダウン | `gcloud run services describe` で確認 |
