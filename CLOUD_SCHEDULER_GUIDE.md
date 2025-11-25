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
