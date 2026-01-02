#!/bin/bash

# 品番抽出とdescription更新用のCloud Run Jobsをデプロイ

PROJECT_ID="adult-v"
REGION="asia-northeast1"
IMAGE_NAME="asia-northeast1-docker.pkg.dev/adult-v/cloud-run-source-deploy/crawlers:latest"

echo "=== 品番抽出・エンリッチメントジョブのデプロイ ==="

# 1. 品番抽出ジョブ（全ASP）
echo ""
echo "--- extract-product-codes ジョブを作成/更新 ---"
gcloud run jobs create extract-product-codes \
  --image=$IMAGE_NAME \
  --region=$REGION \
  --command="npx" \
  --args="tsx,packages/crawlers/src/enrichment/extract-product-codes.ts,--asp=all,--limit=10000" \
  --max-retries=1 \
  --task-timeout=1800s \
  --memory=1Gi \
  --cpu=1 \
  --project=$PROJECT_ID \
  2>/dev/null || \
gcloud run jobs update extract-product-codes \
  --image=$IMAGE_NAME \
  --region=$REGION \
  --command="npx" \
  --args="tsx,packages/crawlers/src/enrichment/extract-product-codes.ts,--asp=all,--limit=10000" \
  --max-retries=1 \
  --task-timeout=1800s \
  --memory=1Gi \
  --cpu=1 \
  --project=$PROJECT_ID

# 2. MGS description バックフィル用ジョブ
echo ""
echo "--- mgs-description-backfill ジョブを作成/更新 ---"
gcloud run jobs create mgs-description-backfill \
  --image=$IMAGE_NAME \
  --region=$REGION \
  --command="npx" \
  --args="tsx,packages/crawlers/src/enrichment/backfill-mgs-description.ts,--limit=2000" \
  --max-retries=1 \
  --task-timeout=7200s \
  --memory=1Gi \
  --cpu=1 \
  --project=$PROJECT_ID \
  2>/dev/null || \
gcloud run jobs update mgs-description-backfill \
  --image=$IMAGE_NAME \
  --region=$REGION \
  --command="npx" \
  --args="tsx,packages/crawlers/src/enrichment/backfill-mgs-description.ts,--limit=2000" \
  --max-retries=1 \
  --task-timeout=7200s \
  --memory=1Gi \
  --cpu=1 \
  --project=$PROJECT_ID

echo ""
echo "=== ジョブ作成完了 ==="
echo ""
echo "ジョブを実行するには:"
echo "  gcloud run jobs execute extract-product-codes --region=$REGION --project=$PROJECT_ID"
echo "  gcloud run jobs execute mgs-description-backfill --region=$REGION --project=$PROJECT_ID"
