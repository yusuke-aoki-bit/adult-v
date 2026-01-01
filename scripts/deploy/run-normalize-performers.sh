#!/bin/bash
# 演者名寄せジョブ
# 商品に演者情報を紐付け（wiki_crawl_data, product_performer_lookup を使用）
#
# 使用方法: bash scripts/deploy/run-normalize-performers.sh [--create-only] [--step status|crawl|link|search|all]

PROJECT=adult-v
REGION=asia-northeast1
IMAGE=us-central1-docker.pkg.dev/adult-v/adult-v-crawlers/crawler:latest
JOB_NAME="normalize-performers"

CREATE_ONLY=false
STEP="all"
LIMIT=5000

for arg in "$@"; do
  case $arg in
    --create-only) CREATE_ONLY=true ;;
    --step=*) STEP="${arg#*=}" ;;
    --limit=*) LIMIT="${arg#*=}" ;;
  esac
done

echo "=== 演者名寄せジョブ ==="
echo "リージョン: $REGION"
echo "ステップ: $STEP"
echo "上限: $LIMIT件"
echo "モード: $([ "$CREATE_ONLY" = true ] && echo "作成のみ" || echo "作成＆実行")"
echo ""

ARGS="tsx,scripts/pipeline/performer-lookup-pipeline.ts,${STEP},--limit=${LIMIT}"

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
    --args="$ARGS" \
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
    --args="$ARGS" \
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
