#!/bin/bash
# Deploy crawler jobs to Google Cloud Run Jobs
# Run this script from the adult-v directory

set -e

PROJECT_ID="adult-v"
REGION="us-central1"
IMAGE_NAME="adult-v-crawler"
DATABASE_URL="postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres"

echo "Building and pushing Docker image..."
gcloud builds submit --config cloudbuild.yaml .

echo "Creating/updating Cloud Run Jobs..."

# MGS Crawler Job - Daily at 2:00 AM JST (17:00 UTC previous day)
gcloud run jobs create mgs-crawler \
  --image us-central1-docker.pkg.dev/${PROJECT_ID}/adult-v-crawlers/crawler:latest \
  --region ${REGION} \
  --set-env-vars DATABASE_URL="${DATABASE_URL}" \
  --args="mgs,--pages,20" \
  --max-retries 3 \
  --task-timeout 3600s \
  --memory 2Gi \
  --cpu 2 \
  || gcloud run jobs update mgs-crawler \
  --image us-central1-docker.pkg.dev/${PROJECT_ID}/adult-v-crawlers/crawler:latest \
  --region ${REGION} \
  --set-env-vars DATABASE_URL="${DATABASE_URL}" \
  --args="mgs,--pages,20" \
  --max-retries 3 \
  --task-timeout 3600s \
  --memory 2Gi \
  --cpu 2

# Caribbeancom Crawler Job - Daily at 3:00 AM JST (18:00 UTC previous day)
gcloud run jobs create caribbeancom-crawler \
  --image us-central1-docker.pkg.dev/${PROJECT_ID}/adult-v-crawlers/crawler:latest \
  --region ${REGION} \
  --set-env-vars DATABASE_URL="${DATABASE_URL}" \
  --args="caribbeancom,--limit,100" \
  --max-retries 3 \
  --task-timeout 3600s \
  --memory 2Gi \
  --cpu 2 \
  || gcloud run jobs update caribbeancom-crawler \
  --image us-central1-docker.pkg.dev/${PROJECT_ID}/adult-v-crawlers/crawler:latest \
  --region ${REGION} \
  --set-env-vars DATABASE_URL="${DATABASE_URL}" \
  --args="caribbeancom,--limit,100" \
  --max-retries 3 \
  --task-timeout 3600s \
  --memory 2Gi \
  --cpu 2

# HEYZO Crawler Job - Daily at 4:00 AM JST (19:00 UTC previous day)
gcloud run jobs create heyzo-crawler \
  --image us-central1-docker.pkg.dev/${PROJECT_ID}/adult-v-crawlers/crawler:latest \
  --region ${REGION} \
  --set-env-vars DATABASE_URL="${DATABASE_URL}" \
  --args="heyzo,--limit,50" \
  --max-retries 3 \
  --task-timeout 3600s \
  --memory 2Gi \
  --cpu 2 \
  || gcloud run jobs update heyzo-crawler \
  --image us-central1-docker.pkg.dev/${PROJECT_ID}/adult-v-crawlers/crawler:latest \
  --region ${REGION} \
  --set-env-vars DATABASE_URL="${DATABASE_URL}" \
  --args="heyzo,--limit,50" \
  --max-retries 3 \
  --task-timeout 3600s \
  --memory 2Gi \
  --cpu 2

# Caribbeancom Premium Crawler Job - Daily at 5:00 AM JST (20:00 UTC previous day)
gcloud run jobs create caribbeancompr-crawler \
  --image us-central1-docker.pkg.dev/${PROJECT_ID}/adult-v-crawlers/crawler:latest \
  --region ${REGION} \
  --set-env-vars DATABASE_URL="${DATABASE_URL}" \
  --args="caribbeancompr,--limit,100" \
  --max-retries 3 \
  --task-timeout 3600s \
  --memory 2Gi \
  --cpu 2 \
  || gcloud run jobs update caribbeancompr-crawler \
  --image us-central1-docker.pkg.dev/${PROJECT_ID}/adult-v-crawlers/crawler:latest \
  --region ${REGION} \
  --set-env-vars DATABASE_URL="${DATABASE_URL}" \
  --args="caribbeancompr,--limit,100" \
  --max-retries 3 \
  --task-timeout 3600s \
  --memory 2Gi \
  --cpu 2

# 1pondo Crawler Job - Daily at 6:00 AM JST (21:00 UTC previous day)
gcloud run jobs create ippondo-crawler \
  --image us-central1-docker.pkg.dev/${PROJECT_ID}/adult-v-crawlers/crawler:latest \
  --region ${REGION} \
  --set-env-vars DATABASE_URL="${DATABASE_URL}" \
  --args="1pondo,--limit,100" \
  --max-retries 3 \
  --task-timeout 3600s \
  --memory 2Gi \
  --cpu 2 \
  || gcloud run jobs update ippondo-crawler \
  --image us-central1-docker.pkg.dev/${PROJECT_ID}/adult-v-crawlers/crawler:latest \
  --region ${REGION} \
  --set-env-vars DATABASE_URL="${DATABASE_URL}" \
  --args="1pondo,--limit,100" \
  --max-retries 3 \
  --task-timeout 3600s \
  --memory 2Gi \
  --cpu 2

# DUGA Crawler Job - Daily at 7:00 AM JST (22:00 UTC previous day)
gcloud run jobs create duga-crawler \
  --image us-central1-docker.pkg.dev/${PROJECT_ID}/adult-v-crawlers/crawler:latest \
  --region ${REGION} \
  --set-env-vars DATABASE_URL="${DATABASE_URL}" \
  --args="duga" \
  --max-retries 3 \
  --task-timeout 7200s \
  --memory 4Gi \
  --cpu 2 \
  || gcloud run jobs update duga-crawler \
  --image us-central1-docker.pkg.dev/${PROJECT_ID}/adult-v-crawlers/crawler:latest \
  --region ${REGION} \
  --set-env-vars DATABASE_URL="${DATABASE_URL}" \
  --args="duga" \
  --max-retries 3 \
  --task-timeout 7200s \
  --memory 4Gi \
  --cpu 2

echo "Setting up Cloud Scheduler..."

# MGS - Daily at 2:00 AM JST
gcloud scheduler jobs create http mgs-crawler-schedule \
  --location ${REGION} \
  --schedule "0 2 * * *" \
  --time-zone "Asia/Tokyo" \
  --uri "https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/mgs-crawler:run" \
  --http-method POST \
  --oauth-service-account-email "${PROJECT_ID}@appspot.gserviceaccount.com" \
  || gcloud scheduler jobs update http mgs-crawler-schedule \
  --location ${REGION} \
  --schedule "0 2 * * *" \
  --time-zone "Asia/Tokyo"

# Caribbeancom - Daily at 3:00 AM JST
gcloud scheduler jobs create http caribbeancom-crawler-schedule \
  --location ${REGION} \
  --schedule "0 3 * * *" \
  --time-zone "Asia/Tokyo" \
  --uri "https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/caribbeancom-crawler:run" \
  --http-method POST \
  --oauth-service-account-email "${PROJECT_ID}@appspot.gserviceaccount.com" \
  || gcloud scheduler jobs update http caribbeancom-crawler-schedule \
  --location ${REGION} \
  --schedule "0 3 * * *" \
  --time-zone "Asia/Tokyo"

# HEYZO - Daily at 4:00 AM JST
gcloud scheduler jobs create http heyzo-crawler-schedule \
  --location ${REGION} \
  --schedule "0 4 * * *" \
  --time-zone "Asia/Tokyo" \
  --uri "https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/heyzo-crawler:run" \
  --http-method POST \
  --oauth-service-account-email "${PROJECT_ID}@appspot.gserviceaccount.com" \
  || gcloud scheduler jobs update http heyzo-crawler-schedule \
  --location ${REGION} \
  --schedule "0 4 * * *" \
  --time-zone "Asia/Tokyo"

# Caribbeancom Premium - Daily at 5:00 AM JST
gcloud scheduler jobs create http caribbeancompr-crawler-schedule \
  --location ${REGION} \
  --schedule "0 5 * * *" \
  --time-zone "Asia/Tokyo" \
  --uri "https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/caribbeancompr-crawler:run" \
  --http-method POST \
  --oauth-service-account-email "${PROJECT_ID}@appspot.gserviceaccount.com" \
  || gcloud scheduler jobs update http caribbeancompr-crawler-schedule \
  --location ${REGION} \
  --schedule "0 5 * * *" \
  --time-zone "Asia/Tokyo"

# 1pondo - Daily at 6:00 AM JST
gcloud scheduler jobs create http ippondo-crawler-schedule \
  --location ${REGION} \
  --schedule "0 6 * * *" \
  --time-zone "Asia/Tokyo" \
  --uri "https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/ippondo-crawler:run" \
  --http-method POST \
  --oauth-service-account-email "${PROJECT_ID}@appspot.gserviceaccount.com" \
  || gcloud scheduler jobs update http ippondo-crawler-schedule \
  --location ${REGION} \
  --schedule "0 6 * * *" \
  --time-zone "Asia/Tokyo"

# DUGA - Daily at 7:00 AM JST
gcloud scheduler jobs create http duga-crawler-schedule \
  --location ${REGION} \
  --schedule "0 7 * * *" \
  --time-zone "Asia/Tokyo" \
  --uri "https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/duga-crawler:run" \
  --http-method POST \
  --oauth-service-account-email "${PROJECT_ID}@appspot.gserviceaccount.com" \
  || gcloud scheduler jobs update http duga-crawler-schedule \
  --location ${REGION} \
  --schedule "0 7 * * *" \
  --time-zone "Asia/Tokyo"

echo "✓ Deployment complete!"
echo ""
echo "To manually trigger a crawler:"
echo "  gcloud run jobs execute mgs-crawler --region ${REGION}"
echo "  gcloud run jobs execute caribbeancom-crawler --region ${REGION}"
echo "  gcloud run jobs execute heyzo-crawler --region ${REGION}"
echo "  gcloud run jobs execute caribbeancompr-crawler --region ${REGION}"
echo "  gcloud run jobs execute ippondo-crawler --region ${REGION}"
echo "  gcloud run jobs execute duga-crawler --region ${REGION}"
