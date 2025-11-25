#!/bin/bash

# Deploy DUGA Image Crawler to Cloud Run Jobs with Cloud Scheduler
# This script creates:
# 1. Docker image pushed to GCR
# 2. Cloud Run Job for DUGA image crawler
# 3. Cloud Scheduler jobs to trigger batches in parallel

set -e

PROJECT_ID="adult-v"
REGION="asia-northeast1"
SERVICE_ACCOUNT="crawler-service@adult-v.iam.gserviceaccount.com"
IMAGE_NAME="gcr.io/${PROJECT_ID}/duga-image-crawler"
JOB_NAME="duga-image-crawler"
DATABASE_URL="postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres"

# Total batches: 135,895 products / 100 per batch = 1359 batches
TOTAL_BATCHES=1359
BATCH_SIZE=100

# Parallel execution: Run 10 batches at a time
# This reduces 38 hours to ~4 hours
PARALLEL_JOBS=10

echo "🚀 Deploying DUGA Image Crawler to Cloud Run Jobs"
echo "=================================================="
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Total batches: $TOTAL_BATCHES"
echo "Batch size: $BATCH_SIZE products"
echo "Parallel jobs: $PARALLEL_JOBS"
echo "=================================================="
echo ""

# Step 1: Build and push Docker image
echo "📦 Building Docker image..."
docker build -f Dockerfile.crawler -t "$IMAGE_NAME:latest" .

echo "📤 Pushing image to GCR..."
docker push "$IMAGE_NAME:latest"

echo "✅ Image pushed: $IMAGE_NAME:latest"
echo ""

# Step 2: Create Cloud Run Job
echo "🏗️  Creating Cloud Run Job: $JOB_NAME"

gcloud run jobs create "$JOB_NAME" \
  --image="$IMAGE_NAME:latest" \
  --region="$REGION" \
  --service-account="$SERVICE_ACCOUNT" \
  --set-env-vars="DATABASE_URL=$DATABASE_URL" \
  --task-timeout=3600 \
  --max-retries=3 \
  --memory=512Mi \
  --cpu=1 \
  --execute-now=false \
  || echo "Job already exists, updating..."

# Update existing job if creation failed
gcloud run jobs update "$JOB_NAME" \
  --image="$IMAGE_NAME:latest" \
  --region="$REGION" \
  --set-env-vars="DATABASE_URL=$DATABASE_URL" \
  --task-timeout=3600 \
  --max-retries=3 \
  --memory=512Mi \
  --cpu=1 \
  || true

echo "✅ Cloud Run Job created/updated"
echo ""

# Step 3: Create Cloud Scheduler jobs (10 parallel batches)
echo "⏰ Creating Cloud Scheduler jobs for parallel execution..."

for i in $(seq 0 $((PARALLEL_JOBS - 1))); do
  SCHEDULER_NAME="duga-crawler-batch-${i}"

  # Each scheduler handles its share of batches
  # Scheduler 0: batches 0, 10, 20, ... (offset 0, 1000, 2000, ...)
  # Scheduler 1: batches 1, 11, 21, ... (offset 100, 1100, 2100, ...)
  # etc.

  echo "  Creating scheduler: $SCHEDULER_NAME"

  # Create scheduler that triggers every 2 minutes (enough time for each batch)
  # Each scheduler will handle ~136 batches (1359 / 10)

  gcloud scheduler jobs create http "$SCHEDULER_NAME" \
    --location="$REGION" \
    --schedule="*/2 * * * *" \
    --uri="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/${JOB_NAME}:run" \
    --http-method=POST \
    --oauth-service-account-email="$SERVICE_ACCOUNT" \
    --message-body="{\"overrides\":{\"containerOverrides\":[{\"env\":[{\"name\":\"BATCH_OFFSET\",\"value\":\"$((i * BATCH_SIZE))\"},{\"name\":\"BATCH_LIMIT\",\"value\":\"$BATCH_SIZE\"},{\"name\":\"BATCH_STRIDE\",\"value\":\"$((PARALLEL_JOBS * BATCH_SIZE))\"},{\"name\":\"SCHEDULER_ID\",\"value\":\"$i\"}]}]}}" \
    || echo "Scheduler $SCHEDULER_NAME already exists"
done

echo ""
echo "=================================================="
echo "✅ Deployment Complete!"
echo "=================================================="
echo ""
echo "📊 Execution Plan:"
echo "  - Total products: 135,895"
echo "  - Batch size: $BATCH_SIZE products"
echo "  - Total batches: $TOTAL_BATCHES"
echo "  - Parallel jobs: $PARALLEL_JOBS"
echo "  - Estimated time: ~4 hours (vs 38 hours serial)"
echo ""
echo "🎯 Next Steps:"
echo "  1. Pause schedulers initially:"
echo "     gcloud scheduler jobs pause duga-crawler-batch-{0..9} --location=$REGION"
echo ""
echo "  2. Test single execution:"
echo "     gcloud run jobs execute $JOB_NAME --region=$REGION --args=\"--limit=10,--offset=0\""
echo ""
echo "  3. Start parallel execution:"
echo "     gcloud scheduler jobs resume duga-crawler-batch-{0..9} --location=$REGION"
echo ""
echo "  4. Monitor progress:"
echo "     gcloud run jobs executions list --job=$JOB_NAME --region=$REGION"
echo ""
echo "  5. Stop execution:"
echo "     gcloud scheduler jobs pause duga-crawler-batch-{0..9} --location=$REGION"
echo ""
