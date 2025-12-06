#!/bin/bash

# Create Cloud Scheduler jobs for parallel DUGA crawler execution
# This creates 10 scheduler jobs that will run different batch ranges in parallel

set -e

PROJECT_ID="adult-v"
REGION="asia-northeast1"
JOB_NAME="duga-image-crawler"

# Configuration
TOTAL_PRODUCTS=135895
BATCH_SIZE=100
PARALLEL_JOBS=10

# Calculate how many batches each scheduler should handle
BATCHES_PER_SCHEDULER=$((TOTAL_PRODUCTS / BATCH_SIZE / PARALLEL_JOBS + 1))

echo "📅 Creating Cloud Scheduler Jobs for Parallel Execution"
echo "======================================================="
echo "Total products: $TOTAL_PRODUCTS"
echo "Batch size: $BATCH_SIZE"
echo "Parallel jobs: $PARALLEL_JOBS"
echo "Batches per scheduler: ~$BATCHES_PER_SCHEDULER"
echo "======================================================="
echo ""

for i in $(seq 0 $((PARALLEL_JOBS - 1))); do
  SCHEDULER_NAME="duga-crawler-parallel-${i}"
  START_OFFSET=$((i * BATCH_SIZE))

  # Calculate how many products this scheduler will handle
  PRODUCTS_FOR_THIS_SCHEDULER=$((TOTAL_PRODUCTS / PARALLEL_JOBS))
  if [ $i -eq $((PARALLEL_JOBS - 1)) ]; then
    # Last scheduler handles remaining products
    PRODUCTS_FOR_THIS_SCHEDULER=$((TOTAL_PRODUCTS - START_OFFSET))
  fi

  echo "Creating scheduler: $SCHEDULER_NAME"
  echo "  Start offset: $START_OFFSET"
  echo "  Products to handle: ~$PRODUCTS_FOR_THIS_SCHEDULER"
  echo ""

  # Create HTTP scheduler that triggers Cloud Run Job
  # Schedule: Run every 3 minutes (enough for 100 products + buffer)
  # Paused by default - manually resume when ready
  gcloud scheduler jobs create http "$SCHEDULER_NAME" \
    --location="$REGION" \
    --schedule="*/3 * * * *" \
    --time-zone="Asia/Tokyo" \
    --uri="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/${JOB_NAME}:run" \
    --http-method=POST \
    --oauth-service-account-email="crawler-service@${PROJECT_ID}.iam.gserviceaccount.com" \
    --headers="Content-Type=application/json" \
    --message-body="{\"overrides\":{\"containerOverrides\":[{\"env\":[{\"name\":\"BATCH_OFFSET\",\"value\":\"${START_OFFSET}\"},{\"name\":\"BATCH_LIMIT\",\"value\":\"${BATCH_SIZE}\"}]}]}}" \
    --attempt-deadline=600s \
    --paused \
    2>&1 || echo "  ⚠️  Scheduler might already exist"

done

echo ""
echo "======================================================="
echo "✅ Scheduler Jobs Created!"
echo "======================================================="
echo ""
echo "📝 Next Steps:"
echo ""
echo "1. List all schedulers:"
echo "   gcloud scheduler jobs list --location=$REGION | grep duga-crawler"
echo ""
echo "2. Resume all schedulers to start parallel execution:"
for i in $(seq 0 $((PARALLEL_JOBS - 1))); do
  echo "   gcloud scheduler jobs resume duga-crawler-parallel-${i} --location=$REGION"
done
echo ""
echo "3. Pause all schedulers to stop execution:"
for i in $(seq 0 $((PARALLEL_JOBS - 1))); do
  echo "   gcloud scheduler jobs pause duga-crawler-parallel-${i} --location=$REGION"
done
echo ""
echo "4. Monitor job executions:"
echo "   gcloud run jobs executions list --job=$JOB_NAME --region=$REGION"
echo ""
echo "5. Delete schedulers when done:"
for i in $(seq 0 $((PARALLEL_JOBS - 1))); do
  echo "   gcloud scheduler jobs delete duga-crawler-parallel-${i} --location=$REGION --quiet"
done
echo ""
