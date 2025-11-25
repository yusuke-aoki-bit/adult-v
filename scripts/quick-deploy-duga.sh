#!/bin/bash
# DUGA画像クローラーの簡易デプロイ & 実行開始スクリプト

set -e

PROJECT_ID="adult-v"
REGION="asia-northeast1"
SERVICE_ACCOUNT="646431984228-compute@developer.gserviceaccount.com"
DATABASE_URL="postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres"
IMAGE="gcr.io/${PROJECT_ID}/duga-image-crawler:latest"

echo "🚀 Quick Deploy: DUGA Image Crawler"
echo "===================================="

# Note: Image should already be built via gcloud builds submit
# Skip docker push - Cloud Build handles this

# Create/Update Cloud Run Job
echo "☁️  Creating Cloud Run Job..."
gcloud run jobs delete duga-image-crawler --region="$REGION" --quiet 2>/dev/null || true

gcloud run jobs create duga-image-crawler \
  --image="$IMAGE" \
  --region="$REGION" \
  --service-account="$SERVICE_ACCOUNT" \
  --set-env-vars="DATABASE_URL=$DATABASE_URL" \
  --task-timeout=3600 \
  --max-retries=2 \
  --memory=512Mi \
  --cpu=1

echo "✅ Job created!"

# Test execution
echo ""
echo "🧪 Running test execution (10 products)..."
gcloud run jobs execute duga-image-crawler \
  --region="$REGION" \
  --args="--limit=10,--offset=100" \
  --wait

echo ""
echo "✅ Test completed! Now starting parallel schedulers..."
echo ""

# Create 10 parallel schedulers
for i in {0..9}; do
  NAME="duga-parallel-${i}"
  OFFSET=$((i * 100))

  # Delete if exists
  gcloud scheduler jobs delete "$NAME" --location="$REGION" --quiet 2>/dev/null || true

  # Create scheduler (paused)
  gcloud scheduler jobs create http "$NAME" \
    --location="$REGION" \
    --schedule="*/3 * * * *" \
    --time-zone="Asia/Tokyo" \
    --uri="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/duga-image-crawler:run" \
    --http-method=POST \
    --oauth-service-account-email="$SERVICE_ACCOUNT" \
    --headers="Content-Type=application/json" \
    --message-body="{\"overrides\":{\"containerOverrides\":[{\"args\":[\"--limit\",\"100\",\"--offset\",\"${OFFSET}\"]}]}}" \
    --paused

  echo "  ✓ Created $NAME (offset $OFFSET)"
done

echo ""
echo "===================================="
echo "✅ Deployment Complete!"
echo "===================================="
echo ""
echo "📊 10 parallel schedulers created (paused)"
echo ""
echo "🎯 To start execution:"
echo "for i in {0..9}; do gcloud scheduler jobs resume duga-parallel-\${i} --location=$REGION; done"
echo ""
echo "📈 Monitor progress:"
echo "gcloud run jobs executions list --job=duga-image-crawler --region=$REGION"
echo ""
