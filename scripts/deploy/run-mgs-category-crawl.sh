#!/bin/bash

# MGSカテゴリ別クロールのCloud Run Jobs実行スクリプト

PROJECT_ID="adult-v"
REGION="us-central1"
IMAGE="us-central1-docker.pkg.dev/adult-v/adult-v-crawlers/crawler:latest"

# カテゴリクロール用ジョブを作成・更新
echo "=== MGSカテゴリクロールジョブの作成/更新 ==="

# 動画配信カテゴリ用（最大1000ページ = 約12万件）
# 935ページ = 112,166件として、100ページずつ10個のジョブで分割
for i in $(seq 1 10); do
  START_PAGE=$(( (i-1) * 100 + 1 ))
  JOB_NAME="mgs-category-haishin-$i"

  echo "Creating/updating job: $JOB_NAME (start-page=$START_PAGE, max-pages=100)"

  gcloud run jobs create $JOB_NAME \
    --region=$REGION \
    --project=$PROJECT_ID \
    --image=$IMAGE \
    --memory=2Gi \
    --cpu=1 \
    --task-timeout=7200s \
    --max-retries=1 \
    --set-env-vars="DATABASE_URL=\$(gcloud secrets versions access latest --secret=database-url --project=$PROJECT_ID)" \
    --args="tsx" \
    --args="packages/crawlers/src/enrichment/crawl-mgs-list.ts" \
    --args="--category-crawl" \
    --args="--category=haishin" \
    --args="--start-page=$START_PAGE" \
    --args="--max-pages=100" \
    --args="--no-ai" \
    2>/dev/null || \
  gcloud run jobs update $JOB_NAME \
    --region=$REGION \
    --project=$PROJECT_ID \
    --image=$IMAGE \
    --memory=2Gi \
    --cpu=1 \
    --task-timeout=7200s \
    --max-retries=1 \
    --args="tsx" \
    --args="packages/crawlers/src/enrichment/crawl-mgs-list.ts" \
    --args="--category-crawl" \
    --args="--category=haishin" \
    --args="--start-page=$START_PAGE" \
    --args="--max-pages=100" \
    --args="--no-ai"
done

# 月額チャンネル用（全チャンネルを1ジョブで）
echo "Creating/updating job: mgs-category-monthly"
gcloud run jobs create mgs-category-monthly \
  --region=$REGION \
  --project=$PROJECT_ID \
  --image=$IMAGE \
  --memory=2Gi \
  --cpu=1 \
  --task-timeout=7200s \
  --max-retries=1 \
  --set-env-vars="DATABASE_URL=\$(gcloud secrets versions access latest --secret=database-url --project=$PROJECT_ID)" \
  --args="tsx" \
  --args="packages/crawlers/src/enrichment/crawl-mgs-list.ts" \
  --args="--category-crawl" \
  --args="--category=monthly" \
  --args="--max-pages=100" \
  --args="--no-ai" \
  2>/dev/null || \
gcloud run jobs update mgs-category-monthly \
  --region=$REGION \
  --project=$PROJECT_ID \
  --image=$IMAGE \
  --memory=2Gi \
  --cpu=1 \
  --task-timeout=7200s \
  --max-retries=1 \
  --args="tsx" \
  --args="packages/crawlers/src/enrichment/crawl-mgs-list.ts" \
  --args="--category-crawl" \
  --args="--category=monthly" \
  --args="--max-pages=100" \
  --args="--no-ai"

echo ""
echo "=== ジョブ一覧 ==="
gcloud run jobs list --region=$REGION --project=$PROJECT_ID --filter="name:mgs-category" --format="table(name,status)"
