# DUGA Image Crawler - Cloud Scheduler Deployment Guide

**Date**: 2025-11-25
**Status**: Ready for deployment
**Local Test**: ✅ 100/100 products successful

---

## 📊 Overview

### Current Status
- **Total DUGA Products**: 135,895
- **Products Missing Thumbnails**: 135,895 (100%)
- **First Batch Test**: ✅ 100/100 successful (offset 0-100)

### Execution Strategy
- **Local Sequential**: ~38 hours (1359 batches × 100 seconds/batch)
- **Cloud Parallel (10 jobs)**: ~4 hours (136 batches/job × 100 seconds/batch)

---

## 🎯 Deployment Options

### Option 1: Continue Local Execution (Simple)

Run the batch script that handles all 1,359 batches sequentially:

```bash
cd C:\Users\yuuku\cursor\adult-v
bash scripts/run-duga-batches.sh
```

**Pros:**
- Simple, no cloud setup required
- Already tested and working
- Can resume from any batch if interrupted

**Cons:**
- Takes ~38 hours
- Requires keeping local machine running
- Single point of failure

### Option 2: Cloud Scheduler Parallel Execution (Recommended)

Deploy to Cloud Run Jobs with Cloud Scheduler for parallel processing:

#### Step 1: Build and Deploy Docker Image

```bash
cd C:\Users\yuuku\cursor\adult-v

# Build image
docker build -f Dockerfile.crawler -t gcr.io/adult-v/duga-image-crawler:latest .

# Push to GCR
docker push gcr.io/adult-v/duga-image-crawler:latest
```

#### Step 2: Create Cloud Run Job

```bash
gcloud run jobs create duga-image-crawler \
  --image=gcr.io/adult-v/duga-image-crawler:latest \
  --region=asia-northeast1 \
  --service-account=crawler-service@adult-v.iam.gserviceaccount.com \
  --set-env-vars="DATABASE_URL=postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres" \
  --task-timeout=3600 \
  --max-retries=3 \
  --memory=512Mi \
  --cpu=1
```

#### Step 3: Test Single Execution

```bash
# Test with 10 products
gcloud run jobs execute duga-image-crawler \
  --region=asia-northeast1 \
  --args="--limit=10,--offset=0"

# Check execution status
gcloud run jobs executions list \
  --job=duga-image-crawler \
  --region=asia-northeast1 \
  --limit=5
```

#### Step 4: Create Parallel Cloud Schedulers

```bash
cd C:\Users\yuuku\cursor\adult-v
bash scripts/create-parallel-schedulers.sh
```

This creates 10 scheduler jobs:
- `duga-crawler-parallel-0` (offset 0)
- `duga-crawler-parallel-1` (offset 100)
- `duga-crawler-parallel-2` (offset 200)
- ...
- `duga-crawler-parallel-9` (offset 900)

Each scheduler triggers every 3 minutes and processes its assigned range.

#### Step 5: Start Parallel Execution

```bash
# Resume all schedulers
for i in {0..9}; do
  gcloud scheduler jobs resume duga-crawler-parallel-${i} --location=asia-northeast1
done
```

#### Step 6: Monitor Progress

```bash
# View recent executions
gcloud run jobs executions list \
  --job=duga-image-crawler \
  --region=asia-northeast1 \
  --limit=20

# Check specific execution logs
gcloud logging read "resource.type=cloud_run_job AND resource.labels.job_name=duga-image-crawler" \
  --limit=50 \
  --format=json
```

#### Step 7: Stop Execution (if needed)

```bash
# Pause all schedulers
for i in {0..9}; do
  gcloud scheduler jobs pause duga-crawler-parallel-${i} --location=asia-northeast1
done
```

#### Step 8: Cleanup After Completion

```bash
# Delete schedulers
for i in {0..9}; do
  gcloud scheduler jobs delete duga-crawler-parallel-${i} --location=asia-northeast1 --quiet
done

# Optionally delete the job
gcloud run jobs delete duga-image-crawler --region=asia-northeast1 --quiet
```

---

## 🔧 Alternative: Manual Batch Execution

If you want more control, manually trigger batches:

```bash
# Process batches 0-99 (10,000 products)
for i in {0..99}; do
  offset=$((i * 100))
  echo "Processing batch $i (offset $offset)"

  gcloud run jobs execute duga-image-crawler \
    --region=asia-northeast1 \
    --args="--limit=100,--offset=${offset}" \
    --wait
done
```

---

## 📈 Progress Tracking

### Check Database Progress

```bash
PGPASSWORD='AdultV2024!Secure' psql -h 34.27.234.120 -U adult-v -d postgres -c \
  "SELECT
    COUNT(*) as total_duga,
    COUNT(default_thumbnail_url) as with_thumbnail,
    COUNT(*) - COUNT(default_thumbnail_url) as without_thumbnail,
    ROUND(100.0 * COUNT(default_thumbnail_url) / COUNT(*), 2) as coverage_percent
  FROM products p
  INNER JOIN product_sources ps ON p.id = ps.product_id
  WHERE ps.asp_name = 'DUGA';"
```

### Expected Progress

| Time Elapsed | Products Processed | Coverage | Remaining |
|--------------|-------------------|----------|-----------|
| 0h (start)   | 0                 | 0%       | 135,895   |
| 1h           | ~36,000           | 26%      | ~100,000  |
| 2h           | ~72,000           | 53%      | ~64,000   |
| 3h           | ~108,000          | 79%      | ~28,000   |
| 4h           | ~135,895          | 100%     | 0         |

---

## 🎯 Recommendation

**For production:** Use **Option 2** (Cloud Scheduler Parallel Execution)

**Reasons:**
1. **10x faster**: 4 hours vs 38 hours
2. **More reliable**: Cloud Run handles retries and failures
3. **Better monitoring**: Cloud Logging and Cloud Monitoring integration
4. **Cost-effective**: Pay only for execution time (~$0.50 total)
5. **Scalable**: Easy to add more parallel workers if needed

**For testing/small batches:** Use local execution with `--limit` and `--offset` flags

---

## 🚨 Important Notes

1. **Rate Limiting**: Each batch waits 1 second between products to avoid overwhelming DUGA servers
2. **Idempotency**: Script checks for existing thumbnails and skips already-processed products
3. **Resume Support**: If interrupted, can resume from any batch using `--offset`
4. **Error Handling**: Failed products are logged and can be retried separately
5. **Database Load**: 10 parallel jobs should be fine, but monitor database connections

---

## 📝 Next Steps After DUGA

Once DUGA image crawling is complete:

1. **MGS Re-crawl** (7,346 products) - [Priority: Medium]
2. **Performer Name Normalization** (47,620 products) - [Priority: Low]

See [INVESTIGATION_REPORT.md](./INVESTIGATION_REPORT.md) for full details.

---

## 🕷️ Cron API Endpoints (Cloud Scheduler Integration)

### Available Endpoints

| Endpoint | Provider | Description |
|----------|----------|-------------|
| `/api/cron/crawl-duga` | DUGA | DUGA API経由で新着作品を取得 |
| `/api/cron/crawl-sokmil` | ソクミル | Sokmil API経由で新着作品を取得 |
| `/api/cron/crawl-sokmil-scrape` | ソクミル | Sokmilスクレイピング版（API障害時の代替） |
| `/api/cron/crawl-dti` | DTI | DTI系サイトをクロール（カリビ、一本道、HEYZO等） |
| `/api/cron/crawl-mgs` | MGS | MGS動画の商品一覧から新着作品を取得 |
| `/api/cron/crawl-b10f` | B10F | B10F CSV経由で作品を取得 |
| `/api/cron/crawl-japanska` | Japanska | HTMLクロールで作品を取得 |
| `/api/cron/crawl-fc2` | FC2 | HTMLクロールで作品を取得 |
| `/api/cron/process-raw-data` | 全て | 生データを正規化処理 |
| `/api/cron/normalize-performers` | 全て | Wiki出演者名寄せ（全ASP対応） |
| `/api/cron/backfill-images` | 全て | サムネイルなし商品の画像取得 |
| `/api/cron/backfill-videos` | 全て | サンプル動画なし商品の動画取得 |
| `/api/cron/cleanup` | 全て | 重複チェック/データクリーンアップ |
| `/api/cron/status` | - | ジョブステータス確認 |

### Cloud Scheduler Setup for Parallel Crawling

#### Japanska (収集率: 1% → 目標: 10%+)

```bash
# Japanskaスケジューラー作成（10並列）
for i in {0..9}; do
  start=$((30000 + i * 1000))
  gcloud scheduler jobs create http japanska-crawler-${i} \
    --location=asia-northeast1 \
    --schedule="*/10 * * * *" \
    --uri="https://your-app.run.app/api/cron/crawl-japanska?start=${start}&limit=50" \
    --http-method=GET \
    --headers="X-Cron-Secret=${CRON_SECRET}" \
    --time-zone="Asia/Tokyo"
done
```

#### FC2 (収集率: 0.01% → 目標: 1%+)

```bash
# FC2スケジューラー作成（5並列、レート制限考慮）
for i in {0..4}; do
  page=$((1 + i * 10))
  gcloud scheduler jobs create http fc2-crawler-${i} \
    --location=asia-northeast1 \
    --schedule="*/15 * * * *" \
    --uri="https://your-app.run.app/api/cron/crawl-fc2?page=${page}&endPage=$((page + 9))&limit=50" \
    --http-method=GET \
    --headers="X-Cron-Secret=${CRON_SECRET}" \
    --time-zone="Asia/Tokyo"
done
```

#### DTI (42,269作品 → 収集拡大)

```bash
# DTIスケジューラー作成（サイト別、各5並列）
# カリビアンコム
for i in {0..4}; do
  gcloud scheduler jobs create http dti-caribbeancom-${i} \
    --location=asia-northeast1 \
    --schedule="*/10 * * * *" \
    --uri="https://your-app.run.app/api/cron/crawl-dti?site=caribbeancom&limit=50" \
    --http-method=GET \
    --headers="X-Cron-Secret=${CRON_SECRET}" \
    --time-zone="Asia/Tokyo"
done

# 一本道
for i in {0..4}; do
  gcloud scheduler jobs create http dti-1pondo-${i} \
    --location=asia-northeast1 \
    --schedule="*/10 * * * *" \
    --uri="https://your-app.run.app/api/cron/crawl-dti?site=1pondo&limit=50" \
    --http-method=GET \
    --headers="X-Cron-Secret=${CRON_SECRET}" \
    --time-zone="Asia/Tokyo"
done

# HEYZO
for i in {0..4}; do
  gcloud scheduler jobs create http dti-heyzo-${i} \
    --location=asia-northeast1 \
    --schedule="*/10 * * * *" \
    --uri="https://your-app.run.app/api/cron/crawl-dti?site=heyzo&limit=50" \
    --http-method=GET \
    --headers="X-Cron-Secret=${CRON_SECRET}" \
    --time-zone="Asia/Tokyo"
done
```

#### MGS (7,337作品 → 収集拡大)

```bash
# MGSスケジューラー作成（5並列、ページ別）
for i in {0..4}; do
  page=$((1 + i))
  gcloud scheduler jobs create http mgs-crawler-${i} \
    --location=asia-northeast1 \
    --schedule="*/10 * * * *" \
    --uri="https://your-app.run.app/api/cron/crawl-mgs?page=${page}&limit=30" \
    --http-method=GET \
    --headers="X-Cron-Secret=${CRON_SECRET}" \
    --time-zone="Asia/Tokyo"
done
```

#### ソクミル (API版 + スクレイピング版)

```bash
# Sokmil API版（API復旧時用）
gcloud scheduler jobs create http sokmil-api-crawler \
  --location=asia-northeast1 \
  --schedule="0 */2 * * *" \
  --uri="https://your-app.run.app/api/cron/crawl-sokmil?limit=100" \
  --http-method=GET \
  --headers="X-Cron-Secret=${CRON_SECRET}" \
  --time-zone="Asia/Tokyo"

# Sokmil スクレイピング版（API障害時の代替）
for i in {0..4}; do
  page=$((1 + i))
  gcloud scheduler jobs create http sokmil-scrape-${i} \
    --location=asia-northeast1 \
    --schedule="*/10 * * * *" \
    --uri="https://your-app.run.app/api/cron/crawl-sokmil-scrape?page=${page}&limit=50" \
    --http-method=GET \
    --headers="X-Cron-Secret=${CRON_SECRET}" \
    --time-zone="Asia/Tokyo"
done
```

#### 出演者名寄せ（Wiki連携 - 全ASP対応）

出演者情報がない商品の品番をWikiで検索し、出演者情報を取得・紐付け。
`/api/cron/normalize-performers` は `asp` パラメータで対象ASPを指定可能。

```bash
# 全ASP用スケジューラー作成（ASP毎に5並列、各50件）
# 対応ASP: DUGA, MGS, DTI, b10f, Sokmil, Japanska, FC2

for asp in DUGA MGS DTI Sokmil; do
  for i in {0..4}; do
    offset=$((i * 50))
    gcloud scheduler jobs create http normalize-performers-${asp,,}-${i} \
      --location=asia-northeast1 \
      --schedule="*/15 * * * *" \
      --uri="https://your-app.run.app/api/cron/normalize-performers?asp=${asp}&limit=50&offset=${offset}" \
      --http-method=GET \
      --headers="X-Cron-Secret=${CRON_SECRET}" \
      --time-zone="Asia/Tokyo"
  done
done

# 全ASP一括処理（aspパラメータなし）
gcloud scheduler jobs create http normalize-performers-all \
  --location=asia-northeast1 \
  --schedule="0 */4 * * *" \
  --uri="https://your-app.run.app/api/cron/normalize-performers?limit=100" \
  --http-method=GET \
  --headers="X-Cron-Secret=${CRON_SECRET}" \
  --time-zone="Asia/Tokyo"
```

**名寄せ対象（Wiki検索で品番が見つかるASP）:**
| ASP | 未整理件数 | 名寄せ成功見込み | 備考 |
|-----|-----------|----------------|------|
| MGS | 4,510 | 90%+ | 標準品番形式（ABC-123）|
| DUGA | 19,003 | 70%+ | 標準品番形式（ABC-123）|
| Sokmil | 未計測 | 80%+ | 標準品番形式（ABC-123）|
| DTI | 32,775 | 30%未満 | 内部品番形式（123456_789）|
| b10f | 15,459 | 0% | 内部ID形式（52134）|

※ DTI/b10fは品番形式がWiki検索に適さないため、別途クロールでの出演者取得を推奨

### Query Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `limit` | 処理する作品数上限 | 50-100 |
| `offset` / `start` | 開始位置（ID or オフセット）| 0 |
| `page` | ページ番号（FC2用）| 1 |
| `endPage` | 終了ページ（FC2用）| 5 |

### Authentication

```bash
# 環境変数に設定
export CRON_SECRET="your-secure-secret-key"

# リクエスト例
curl -X GET "https://your-app.run.app/api/cron/crawl-japanska?start=34000&limit=10" \
  -H "X-Cron-Secret: ${CRON_SECRET}"
```

### 収集率目標

| Provider | 現在 | 推定総数 | 目標収集数 | 目標率 |
|----------|------|----------|-----------|--------|
| DUGA | 10% | 500,000 | 100,000 | 20% |
| MGS | 7% | 100,000 | 30,000 | 30% |
| Japanska | 1% | 40,000 | 10,000 | 25% |
| FC2 | 0.01% | 1,000,000 | 10,000 | 1% |
| ソクミル | 0% | 200,000 | 20,000 | 10% |

---

## 🔧 データメンテナンス用API

### 画像バックフィル

サムネイルなし商品の画像を取得:

```bash
# MGSの画像を50件バックフィル
curl -X GET "https://your-app.run.app/api/cron/backfill-images?limit=50&asp=MGS" \
  -H "X-Cron-Secret: ${CRON_SECRET}"

# 全ASP対象
curl -X GET "https://your-app.run.app/api/cron/backfill-images?limit=100" \
  -H "X-Cron-Secret: ${CRON_SECRET}"
```

Cloud Scheduler設定:

```bash
# 画像バックフィル（毎時、ASP別）
for asp in MGS DUGA SOKMIL; do
  gcloud scheduler jobs create http backfill-images-${asp,,} \
    --location=asia-northeast1 \
    --schedule="0 * * * *" \
    --uri="https://your-app.run.app/api/cron/backfill-images?asp=${asp}&limit=50" \
    --http-method=GET \
    --headers="X-Cron-Secret=${CRON_SECRET}" \
    --time-zone="Asia/Tokyo"
done
```

### 動画バックフィル

サンプル動画なし商品の動画URLを取得:

```bash
# MGSの動画を50件バックフィル
curl -X GET "https://your-app.run.app/api/cron/backfill-videos?limit=50&asp=MGS" \
  -H "X-Cron-Secret: ${CRON_SECRET}"

# 全ASP対象
curl -X GET "https://your-app.run.app/api/cron/backfill-videos?limit=100" \
  -H "X-Cron-Secret: ${CRON_SECRET}"
```

Cloud Scheduler設定:

```bash
# 動画バックフィル（毎時、ASP別）
for asp in MGS DUGA SOKMIL; do
  gcloud scheduler jobs create http backfill-videos-${asp,,} \
    --location=asia-northeast1 \
    --schedule="30 * * * *" \
    --uri="https://your-app.run.app/api/cron/backfill-videos?asp=${asp}&limit=50" \
    --http-method=GET \
    --headers="X-Cron-Secret=${CRON_SECRET}" \
    --time-zone="Asia/Tokyo"
done
```

### データクリーンアップ

重複チェックと孤立データの削除:

```bash
# チェックのみ（修正なし）
curl -X GET "https://your-app.run.app/api/cron/cleanup?action=check" \
  -H "X-Cron-Secret: ${CRON_SECRET}"

# 重複チェックのみ
curl -X GET "https://your-app.run.app/api/cron/cleanup?action=check&type=duplicates" \
  -H "X-Cron-Secret: ${CRON_SECRET}"

# 孤立データチェックのみ
curl -X GET "https://your-app.run.app/api/cron/cleanup?action=check&type=orphans" \
  -H "X-Cron-Secret: ${CRON_SECRET}"

# 問題を修正
curl -X GET "https://your-app.run.app/api/cron/cleanup?action=fix" \
  -H "X-Cron-Secret: ${CRON_SECRET}"
```

Cloud Scheduler設定:

```bash
# クリーンアップ（毎日深夜3時、チェックのみ）
gcloud scheduler jobs create http cleanup-check \
  --location=asia-northeast1 \
  --schedule="0 3 * * *" \
  --uri="https://your-app.run.app/api/cron/cleanup?action=check" \
  --http-method=GET \
  --headers="X-Cron-Secret=${CRON_SECRET}" \
  --time-zone="Asia/Tokyo"

# クリーンアップ（毎週日曜深夜4時、修正実行）
gcloud scheduler jobs create http cleanup-fix \
  --location=asia-northeast1 \
  --schedule="0 4 * * 0" \
  --uri="https://your-app.run.app/api/cron/cleanup?action=fix" \
  --http-method=GET \
  --headers="X-Cron-Secret=${CRON_SECRET}" \
  --time-zone="Asia/Tokyo"
```

#### クリーンアップ対象

| 種類 | 説明 | action=fix時の動作 |
|------|------|-------------------|
| 重複商品 | 同一normalized_product_idで複数レコード | 最新を残して削除 |
| 重複出演者 | 同一名で複数レコード | 最小IDに統合 |
| 孤立product_sources | 存在しないproduct_idを参照 | 削除 |
| 孤立product_videos | 存在しないproduct_idを参照 | 削除 |
| 孤立product_performers | 存在しない参照 | 削除 |
| タイトルなし商品 | titleがNULLまたは空 | 削除 |
