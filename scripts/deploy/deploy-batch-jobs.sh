#!/bin/bash

# Cloud Run Jobsにバッチ処理をデプロイして並列実行

PROJECT_ID="adult-v"
REGION="asia-northeast1"
IMAGE_NAME="gcr.io/${PROJECT_ID}/adult-v-batch"
DATABASE_URL="postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres"

echo "=== Building and pushing Docker image ==="
docker build -f Dockerfile.batch -t $IMAGE_NAME .
docker push $IMAGE_NAME

echo ""
echo "=== Creating Cloud Run Jobs ==="

# 各ソース用のジョブを作成
declare -A SOURCES
SOURCES["ipondo"]="一本道"
SOURCES["carib"]="カリビアンコム"
SOURCES["carib-premium"]="カリビアンコムプレミアム"
SOURCES["heyzo"]="HEYZO"
SOURCES["heydouga"]="Hey動画"
SOURCES["nyotai"]="女体のしんぴ"
SOURCES["unkotare"]="うんこたれ"

for key in "${!SOURCES[@]}"; do
  source="${SOURCES[$key]}"
  job_name="reparse-performers-${key}"

  echo "Creating job: $job_name (source: $source)"

  gcloud run jobs create $job_name \
    --image=$IMAGE_NAME \
    --region=$REGION \
    --set-env-vars="SOURCE=${source},LIMIT=50000,DATABASE_URL=${DATABASE_URL}" \
    --max-retries=1 \
    --task-timeout=3600s \
    --memory=2Gi \
    --cpu=1 \
    --project=$PROJECT_ID \
    2>/dev/null || \
  gcloud run jobs update $job_name \
    --image=$IMAGE_NAME \
    --region=$REGION \
    --set-env-vars="SOURCE=${source},LIMIT=50000,DATABASE_URL=${DATABASE_URL}" \
    --max-retries=1 \
    --task-timeout=3600s \
    --memory=2Gi \
    --cpu=1 \
    --project=$PROJECT_ID
done

echo ""
echo "=== Running all jobs in parallel ==="

for key in "${!SOURCES[@]}"; do
  job_name="reparse-performers-${key}"
  echo "Starting: $job_name"
  gcloud run jobs execute $job_name \
    --region=$REGION \
    --project=$PROJECT_ID \
    --async &
done

wait

echo ""
echo "=== All jobs started! ==="
echo "Monitor at: https://console.cloud.google.com/run/jobs?project=${PROJECT_ID}"
