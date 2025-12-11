#!/bin/bash
# MGS フルスキャンジョブ
# 全シリーズを単一ジョブでクロール（--full-scan オプション使用）
#
# 使用方法: bash scripts/deploy/run-mgs-fullscan.sh [--create-only]

PROJECT=adult-v
REGION=asia-northeast1  # 日本リージョン
IMAGE=us-central1-docker.pkg.dev/adult-v/adult-v-crawlers/crawler:latest
JOB_NAME="mgs-fullscan"

CREATE_ONLY=false
for arg in "$@"; do
  case $arg in
    --create-only) CREATE_ONLY=true ;;
  esac
done

echo "=== MGS フルスキャンジョブ ==="
echo "リージョン: $REGION (日本)"
echo "モード: $([ "$CREATE_ONLY" = true ] && echo "作成のみ" || echo "作成＆実行")"
echo ""

# ジョブが存在するか確認
if gcloud run jobs describe $JOB_NAME --project=$PROJECT --region=$REGION &>/dev/null; then
  echo "[$JOB_NAME] 既存のジョブを更新"
  gcloud run jobs update $JOB_NAME \
    --project=$PROJECT \
    --region=$REGION \
    --image=$IMAGE \
    --task-timeout=43200 \
    --max-retries=1 \
    --memory=4Gi \
    --cpu=2 \
    --args="tsx,packages/crawlers/src/enrichment/crawl-mgs-list.ts,--full-scan,--no-ai" \
    --set-secrets="DATABASE_URL=database-url:latest" \
    2>&1
else
  echo "[$JOB_NAME] 新規ジョブを作成"
  gcloud run jobs create $JOB_NAME \
    --project=$PROJECT \
    --region=$REGION \
    --image=$IMAGE \
    --task-timeout=43200 \
    --max-retries=1 \
    --memory=4Gi \
    --cpu=2 \
    --command="npx" \
    --args="tsx,packages/crawlers/src/enrichment/crawl-mgs-list.ts,--full-scan,--no-ai" \
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
