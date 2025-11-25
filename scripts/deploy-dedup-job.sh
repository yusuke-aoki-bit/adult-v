#!/bin/bash

# Set variables
PROJECT_ID="adult-v"
REGION="asia-northeast1"
JOB_NAME="performer-dedup"
IMAGE="gcr.io/${PROJECT_ID}/performer-dedup:latest"

echo "Building Docker image..."
gcloud builds submit --config cloudbuild-dedup.yaml .

echo "Creating Cloud Run Job..."
gcloud run jobs create ${JOB_NAME} \
  --image=${IMAGE} \
  --region=${REGION} \
  --max-retries=1 \
  --task-timeout=1h \
  --set-env-vars="DATABASE_URL=postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres" \
  --service-account=646431984228-compute@developer.gserviceaccount.com \
  || gcloud run jobs update ${JOB_NAME} \
  --image=${IMAGE} \
  --region=${REGION} \
  --max-retries=1 \
  --task-timeout=1h \
  --set-env-vars="DATABASE_URL=postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres"

echo "Creating Cloud Scheduler job (daily at 3 AM JST)..."
gcloud scheduler jobs create http ${JOB_NAME}-scheduler \
  --location=${REGION} \
  --schedule="0 3 * * *" \
  --time-zone="Asia/Tokyo" \
  --uri="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/${JOB_NAME}:run" \
  --http-method=POST \
  --oauth-service-account-email=646431984228-compute@developer.gserviceaccount.com \
  || gcloud scheduler jobs update http ${JOB_NAME}-scheduler \
  --location=${REGION} \
  --schedule="0 3 * * *" \
  --time-zone="Asia/Tokyo"

echo "Performer deduplication job deployed successfully!"
echo "Schedule: Daily at 3:00 AM JST"
