#!/bin/bash
# Deploy seesaawiki full crawler job to Google Cloud Run Jobs
# This script deploys multiple parallel jobs for seesaawiki crawling

set -e

PROJECT_ID="adult-v"
REGION="us-central1"
IMAGE_NAME="adult-v-crawler"
DATABASE_URL="postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres"

echo "Building and pushing Docker image..."
gcloud builds submit --config cloudbuild.yaml .

echo "Creating/updating seesaawiki Cloud Run Jobs..."

# Create 5 parallel jobs for different page ranges
# Total: ~9,600 pages (96 pages x 100 entries each)

# Job 1: Pages 1-20 (entries 1-2000)
gcloud run jobs create seesaawiki-crawler-1 \
  --image us-central1-docker.pkg.dev/${PROJECT_ID}/adult-v-crawlers/crawler:latest \
  --region ${REGION} \
  --set-env-vars DATABASE_URL="${DATABASE_URL}" \
  --args="seesaawiki-range,--start,1,--end,20" \
  --max-retries 2 \
  --task-timeout 14400s \
  --memory 2Gi \
  --cpu 1 \
  || gcloud run jobs update seesaawiki-crawler-1 \
  --image us-central1-docker.pkg.dev/${PROJECT_ID}/adult-v-crawlers/crawler:latest \
  --region ${REGION} \
  --set-env-vars DATABASE_URL="${DATABASE_URL}" \
  --args="seesaawiki-range,--start,1,--end,20" \
  --max-retries 2 \
  --task-timeout 14400s \
  --memory 2Gi \
  --cpu 1

# Job 2: Pages 21-40 (entries 2001-4000)
gcloud run jobs create seesaawiki-crawler-2 \
  --image us-central1-docker.pkg.dev/${PROJECT_ID}/adult-v-crawlers/crawler:latest \
  --region ${REGION} \
  --set-env-vars DATABASE_URL="${DATABASE_URL}" \
  --args="seesaawiki-range,--start,21,--end,40" \
  --max-retries 2 \
  --task-timeout 14400s \
  --memory 2Gi \
  --cpu 1 \
  || gcloud run jobs update seesaawiki-crawler-2 \
  --image us-central1-docker.pkg.dev/${PROJECT_ID}/adult-v-crawlers/crawler:latest \
  --region ${REGION} \
  --set-env-vars DATABASE_URL="${DATABASE_URL}" \
  --args="seesaawiki-range,--start,21,--end,40" \
  --max-retries 2 \
  --task-timeout 14400s \
  --memory 2Gi \
  --cpu 1

# Job 3: Pages 41-60 (entries 4001-6000)
gcloud run jobs create seesaawiki-crawler-3 \
  --image us-central1-docker.pkg.dev/${PROJECT_ID}/adult-v-crawlers/crawler:latest \
  --region ${REGION} \
  --set-env-vars DATABASE_URL="${DATABASE_URL}" \
  --args="seesaawiki-range,--start,41,--end,60" \
  --max-retries 2 \
  --task-timeout 14400s \
  --memory 2Gi \
  --cpu 1 \
  || gcloud run jobs update seesaawiki-crawler-3 \
  --image us-central1-docker.pkg.dev/${PROJECT_ID}/adult-v-crawlers/crawler:latest \
  --region ${REGION} \
  --set-env-vars DATABASE_URL="${DATABASE_URL}" \
  --args="seesaawiki-range,--start,41,--end,60" \
  --max-retries 2 \
  --task-timeout 14400s \
  --memory 2Gi \
  --cpu 1

# Job 4: Pages 61-80 (entries 6001-8000)
gcloud run jobs create seesaawiki-crawler-4 \
  --image us-central1-docker.pkg.dev/${PROJECT_ID}/adult-v-crawlers/crawler:latest \
  --region ${REGION} \
  --set-env-vars DATABASE_URL="${DATABASE_URL}" \
  --args="seesaawiki-range,--start,61,--end,80" \
  --max-retries 2 \
  --task-timeout 14400s \
  --memory 2Gi \
  --cpu 1 \
  || gcloud run jobs update seesaawiki-crawler-4 \
  --image us-central1-docker.pkg.dev/${PROJECT_ID}/adult-v-crawlers/crawler:latest \
  --region ${REGION} \
  --set-env-vars DATABASE_URL="${DATABASE_URL}" \
  --args="seesaawiki-range,--start,61,--end,80" \
  --max-retries 2 \
  --task-timeout 14400s \
  --memory 2Gi \
  --cpu 1

# Job 5: Pages 81-96 (entries 8001-9600)
gcloud run jobs create seesaawiki-crawler-5 \
  --image us-central1-docker.pkg.dev/${PROJECT_ID}/adult-v-crawlers/crawler:latest \
  --region ${REGION} \
  --set-env-vars DATABASE_URL="${DATABASE_URL}" \
  --args="seesaawiki-range,--start,81,--end,96" \
  --max-retries 2 \
  --task-timeout 14400s \
  --memory 2Gi \
  --cpu 1 \
  || gcloud run jobs update seesaawiki-crawler-5 \
  --image us-central1-docker.pkg.dev/${PROJECT_ID}/adult-v-crawlers/crawler:latest \
  --region ${REGION} \
  --set-env-vars DATABASE_URL="${DATABASE_URL}" \
  --args="seesaawiki-range,--start,81,--end,96" \
  --max-retries 2 \
  --task-timeout 14400s \
  --memory 2Gi \
  --cpu 1

echo "✓ Deployment complete!"
echo ""
echo "To run all jobs in parallel:"
echo "  gcloud run jobs execute seesaawiki-crawler-1 --region ${REGION} --async"
echo "  gcloud run jobs execute seesaawiki-crawler-2 --region ${REGION} --async"
echo "  gcloud run jobs execute seesaawiki-crawler-3 --region ${REGION} --async"
echo "  gcloud run jobs execute seesaawiki-crawler-4 --region ${REGION} --async"
echo "  gcloud run jobs execute seesaawiki-crawler-5 --region ${REGION} --async"
echo ""
echo "Or run this one-liner:"
echo "  for i in 1 2 3 4 5; do gcloud run jobs execute seesaawiki-crawler-\$i --region ${REGION} --async; done"
