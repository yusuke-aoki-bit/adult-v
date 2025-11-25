#!/bin/bash

# 全クローラーをCloud Run Jobs + Cloud Schedulerにデプロイ
# DUGA画像取得、MGS再クロール、女優名寄せを並列実行

set -e

PROJECT_ID="adult-v"
REGION="asia-northeast1"
SERVICE_ACCOUNT="crawler-service@adult-v.iam.gserviceaccount.com"
DATABASE_URL="postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres"

echo "🚀 Deploying All Crawlers to Cloud Run Jobs"
echo "============================================"
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "============================================"
echo ""

# ====================
# 1. DUGA Image Crawler
# ====================
echo "📦 1/3: Building DUGA Image Crawler..."
DUGA_IMAGE="gcr.io/${PROJECT_ID}/duga-image-crawler:latest"

docker build -f Dockerfile.duga -t "$DUGA_IMAGE" .
docker push "$DUGA_IMAGE"

echo "✅ DUGA image pushed"

# Create/Update DUGA Cloud Run Job
echo "Creating DUGA Cloud Run Job..."
gcloud run jobs create duga-image-crawler \
  --image="$DUGA_IMAGE" \
  --region="$REGION" \
  --service-account="$SERVICE_ACCOUNT" \
  --set-env-vars="DATABASE_URL=$DATABASE_URL" \
  --task-timeout=3600 \
  --max-retries=2 \
  --memory=512Mi \
  --cpu=1 \
  2>&1 || \
gcloud run jobs update duga-image-crawler \
  --image="$DUGA_IMAGE" \
  --region="$REGION" \
  --set-env-vars="DATABASE_URL=$DATABASE_URL" \
  2>&1

echo "✅ DUGA job created/updated"
echo ""

# Create DUGA Schedulers (10 parallel jobs)
echo "Creating DUGA Cloud Schedulers (10 parallel jobs)..."
DUGA_TOTAL=135895
DUGA_BATCH=100
DUGA_PARALLEL=10

for i in $(seq 0 $((DUGA_PARALLEL - 1))); do
  SCHEDULER_NAME="duga-crawler-parallel-${i}"
  START_OFFSET=$((i * DUGA_BATCH))

  gcloud scheduler jobs create http "$SCHEDULER_NAME" \
    --location="$REGION" \
    --schedule="*/3 * * * *" \
    --time-zone="Asia/Tokyo" \
    --uri="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/duga-image-crawler:run" \
    --http-method=POST \
    --oauth-service-account-email="$SERVICE_ACCOUNT" \
    --headers="Content-Type=application/json" \
    --message-body="{\"overrides\":{\"containerOverrides\":[{\"args\":[\"--limit\",\"${DUGA_BATCH}\",\"--offset\",\"${START_OFFSET}\"]}]}}" \
    --attempt-deadline=600s \
    --paused \
    2>&1 || echo "  Scheduler $SCHEDULER_NAME already exists"
done

echo "✅ DUGA schedulers created (paused)"
echo ""

# ====================
# 2. MGS Crawler
# ====================
echo "📦 2/3: Setting up MGS Crawler..."

# MGSは既存のcrawler imageを使用
echo "Creating MGS Cloud Run Job..."
gcloud run jobs create mgs-crawler \
  --image="gcr.io/${PROJECT_ID}/crawler:latest" \
  --region="$REGION" \
  --service-account="$SERVICE_ACCOUNT" \
  --set-env-vars="DATABASE_URL=$DATABASE_URL" \
  --args="mgs" \
  --task-timeout=3600 \
  --max-retries=2 \
  --memory=1Gi \
  --cpu=1 \
  2>&1 || \
gcloud run jobs update mgs-crawler \
  --image="gcr.io/${PROJECT_ID}/crawler:latest" \
  --region="$REGION" \
  --set-env-vars="DATABASE_URL=$DATABASE_URL" \
  2>&1

echo "✅ MGS job created/updated"

# MGS Scheduler (daily execution)
gcloud scheduler jobs create http "mgs-crawler-daily" \
  --location="$REGION" \
  --schedule="0 2 * * *" \
  --time-zone="Asia/Tokyo" \
  --uri="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/mgs-crawler:run" \
  --http-method=POST \
  --oauth-service-account-email="$SERVICE_ACCOUNT" \
  --headers="Content-Type=application/json" \
  --attempt-deadline=1800s \
  --paused \
  2>&1 || echo "  MGS scheduler already exists"

echo "✅ MGS scheduler created (paused)"
echo ""

# ====================
# 3. Performer Name Normalization
# ====================
echo "📦 3/3: Setting up Performer Name Normalization..."

# Create Performer Normalization Job
gcloud run jobs create performer-normalization \
  --image="gcr.io/${PROJECT_ID}/crawler:latest" \
  --region="$REGION" \
  --service-account="$SERVICE_ACCOUNT" \
  --set-env-vars="DATABASE_URL=$DATABASE_URL" \
  --args="normalize-performers" \
  --task-timeout=3600 \
  --max-retries=2 \
  --memory=512Mi \
  --cpu=1 \
  2>&1 || \
gcloud run jobs update performer-normalization \
  --image="gcr.io/${PROJECT_ID}/crawler:latest" \
  --region="$REGION" \
  --set-env-vars="DATABASE_URL=$DATABASE_URL" \
  2>&1

echo "✅ Performer normalization job created/updated"

# Performer Scheduler (weekly execution)
gcloud scheduler jobs create http "performer-normalization-weekly" \
  --location="$REGION" \
  --schedule="0 3 * * 0" \
  --time-zone="Asia/Tokyo" \
  --uri="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/performer-normalization:run" \
  --http-method=POST \
  --oauth-service-account-email="$SERVICE_ACCOUNT" \
  --headers="Content-Type=application/json" \
  --attempt-deadline=1800s \
  --paused \
  2>&1 || echo "  Performer scheduler already exists"

echo "✅ Performer scheduler created (paused)"
echo ""

echo "============================================"
echo "✅ All Crawlers Deployed!"
echo "============================================"
echo ""
echo "📋 Summary:"
echo "  1. DUGA Image Crawler: 10 parallel schedulers (every 3 min)"
echo "  2. MGS Crawler: Daily at 2:00 AM JST"
echo "  3. Performer Normalization: Weekly on Sunday at 3:00 AM JST"
echo ""
echo "🎯 To Start Execution:"
echo ""
echo "# Start DUGA crawlers (all 10 parallel)"
echo "for i in {0..9}; do"
echo "  gcloud scheduler jobs resume duga-crawler-parallel-\${i} --location=$REGION"
echo "done"
echo ""
echo "# Start MGS crawler"
echo "gcloud scheduler jobs resume mgs-crawler-daily --location=$REGION"
echo ""
echo "# Start performer normalization"
echo "gcloud scheduler jobs resume performer-normalization-weekly --location=$REGION"
echo ""
echo "# Or manually trigger now:"
echo "gcloud run jobs execute duga-image-crawler --region=$REGION --args=\"--limit=100,--offset=0\""
echo "gcloud run jobs execute mgs-crawler --region=$REGION"
echo "gcloud run jobs execute performer-normalization --region=$REGION"
echo ""
echo "📊 Monitor Progress:"
echo "gcloud run jobs executions list --region=$REGION --limit=20"
echo ""
