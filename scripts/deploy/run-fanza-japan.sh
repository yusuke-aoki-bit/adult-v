#!/bin/bash
# FANZA クローラー（日本リージョン）
# asia-northeast1で実行してIPブロックを回避
#
# 使用方法: bash scripts/deploy/run-fanza-japan.sh [--create-only] [--pages N]

PROJECT=adult-v
REGION=asia-northeast1  # 日本リージョン
IMAGE=us-central1-docker.pkg.dev/adult-v/adult-v-crawlers/crawler:latest
JOB_NAME="fanza-japan"

CREATE_ONLY=false
PAGES=100  # デフォルト100ページ

for arg in "$@"; do
  case $arg in
    --create-only) CREATE_ONLY=true ;;
    --pages=*) PAGES="${arg#*=}" ;;
  esac
done

echo "=== FANZA クローラー（日本リージョン） ==="
echo "リージョン: $REGION (日本)"
echo "ページ数: $PAGES"
echo "モード: $([ "$CREATE_ONLY" = true ] && echo "作成のみ" || echo "作成＆実行")"
echo ""

# ジョブが存在するか確認
if gcloud run jobs describe $JOB_NAME --project=$PROJECT --region=$REGION &>/dev/null; then
  echo "[$JOB_NAME] 既存のジョブを更新"
  gcloud run jobs update $JOB_NAME \
    --project=$PROJECT \
    --region=$REGION \
    --image=$IMAGE \
    --task-timeout=21600 \
    --max-retries=1 \
    --memory=4Gi \
    --cpu=2 \
    --args="tsx,packages/crawlers/src/products/crawl-fanza.ts,--pages=${PAGES},--limit=10000,--no-ai" \
    --set-secrets="DATABASE_URL=database-url:latest" \
    2>&1
else
  echo "[$JOB_NAME] 新規ジョブを作成"
  gcloud run jobs create $JOB_NAME \
    --project=$PROJECT \
    --region=$REGION \
    --image=$IMAGE \
    --task-timeout=21600 \
    --max-retries=1 \
    --memory=4Gi \
    --cpu=2 \
    --command="npx" \
    --args="tsx,packages/crawlers/src/products/crawl-fanza.ts,--pages=${PAGES},--limit=10000,--no-ai" \
    --set-secrets="DATABASE_URL=database-url:latest" \
    2>&1
fi

if [ "$CREATE_ONLY" = false ]; then
  echo ""
  echo "[$JOB_NAME] 実行開始"
  gcloud run jobs execute $JOB_NAME --project=$PROJECT --region=$REGION
fi

echo ""
echo "=== 完了 ==="
echo "進捗確認:"
echo "  gcloud run jobs executions list --project=$PROJECT --region=$REGION --filter='job:$JOB_NAME'"
echo "  gcloud logging read 'resource.type=\"cloud_run_job\" AND resource.labels.job_name=\"$JOB_NAME\"' --project=$PROJECT --limit=50"
