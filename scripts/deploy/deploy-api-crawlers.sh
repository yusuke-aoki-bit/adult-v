#!/bin/bash

# Deploy DUGA and SOKMIL API Crawlers to Cloud Run Jobs
# This script creates Cloud Run Jobs and Cloud Scheduler jobs for automated API crawling

PROJECT_ID="adult-v"
REGION="asia-northeast1"
SERVICE_ACCOUNT="646431984228-compute@developer.gserviceaccount.com"
DATABASE_URL="postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres"

# DUGA API Configuration
DUGA_APP_ID="WzsUOEt2124UD65BqsHU"
DUGA_AGENT_ID="48611"

# SOKMIL API Configuration
SOKMIL_API_KEY="70c75ce3a36c1f503f2515ff094d6f60"

echo "=========================================="
echo "Deploying DUGA API Crawler"
echo "=========================================="

# Create/Update DUGA API Crawler Cloud Run Job
echo "Creating DUGA API Crawler Cloud Run Job..."
gcloud run jobs create duga-api-crawler \
  --image=gcr.io/${PROJECT_ID}/duga-api-crawler:latest \
  --region=${REGION} \
  --max-retries=1 \
  --task-timeout=30m \
  --set-env-vars="DATABASE_URL=${DATABASE_URL},DUGA_APP_ID=${DUGA_APP_ID},DUGA_AGENT_ID=${DUGA_AGENT_ID}" \
  --service-account=${SERVICE_ACCOUNT} \
  --args="--limit=200,--offset=0" \
  || gcloud run jobs update duga-api-crawler \
  --image=gcr.io/${PROJECT_ID}/duga-api-crawler:latest \
  --region=${REGION} \
  --max-retries=1 \
  --task-timeout=30m \
  --set-env-vars="DATABASE_URL=${DATABASE_URL},DUGA_APP_ID=${DUGA_APP_ID},DUGA_AGENT_ID=${DUGA_AGENT_ID}" \
  --args="--limit=200,--offset=0"

# Create/Update DUGA API Scheduler (Daily at 2 AM JST)
echo "Creating DUGA API Scheduler..."
gcloud scheduler jobs create http duga-api-crawler-scheduler \
  --location=${REGION} \
  --schedule="0 2 * * *" \
  --time-zone="Asia/Tokyo" \
  --uri="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/duga-api-crawler:run" \
  --http-method=POST \
  --oauth-service-account-email=${SERVICE_ACCOUNT} \
  || gcloud scheduler jobs update http duga-api-crawler-scheduler \
  --location=${REGION} \
  --schedule="0 2 * * *" \
  --time-zone="Asia/Tokyo"

echo ""
echo "=========================================="
echo "Deploying SOKMIL API Crawler"
echo "=========================================="

# Create/Update SOKMIL API Crawler Cloud Run Job
echo "Creating SOKMIL API Crawler Cloud Run Job..."
gcloud run jobs create sokmil-api-crawler \
  --image=gcr.io/${PROJECT_ID}/sokmil-api-crawler:latest \
  --region=${REGION} \
  --max-retries=1 \
  --task-timeout=30m \
  --set-env-vars="DATABASE_URL=${DATABASE_URL},SOKMIL_API_KEY=${SOKMIL_API_KEY}" \
  --service-account=${SERVICE_ACCOUNT} \
  --args="--limit=200,--page=1" \
  || gcloud run jobs update sokmil-api-crawler \
  --image=gcr.io/${PROJECT_ID}/sokmil-api-crawler:latest \
  --region=${REGION} \
  --max-retries=1 \
  --task-timeout=30m \
  --set-env-vars="DATABASE_URL=${DATABASE_URL},SOKMIL_API_KEY=${SOKMIL_API_KEY}" \
  --args="--limit=200,--page=1"

# Create/Update SOKMIL API Scheduler (Daily at 2:30 AM JST)
echo "Creating SOKMIL API Scheduler..."
gcloud scheduler jobs create http sokmil-api-crawler-scheduler \
  --location=${REGION} \
  --schedule="30 2 * * *" \
  --time-zone="Asia/Tokyo" \
  --uri="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/sokmil-api-crawler:run" \
  --http-method=POST \
  --oauth-service-account-email=${SERVICE_ACCOUNT} \
  || gcloud scheduler jobs update http sokmil-api-crawler-scheduler \
  --location=${REGION} \
  --schedule="30 2 * * *" \
  --time-zone="Asia/Tokyo"

echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo ""
echo "DUGA API Crawler:"
echo "  - Job: duga-api-crawler"
echo "  - Schedule: Daily at 2:00 AM JST"
echo "  - Limit: 200 products per run"
echo ""
echo "SOKMIL API Crawler:"
echo "  - Job: sokmil-api-crawler"
echo "  - Schedule: Daily at 2:30 AM JST"
echo "  - Limit: 200 products per run"
echo ""
echo "To manually trigger a crawler:"
echo "  gcloud run jobs execute duga-api-crawler --region=${REGION} --wait"
echo "  gcloud run jobs execute sokmil-api-crawler --region=${REGION} --wait"
echo ""
