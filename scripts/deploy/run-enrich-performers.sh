#!/bin/bash
# 演者紐付け補填ジョブ
# 商品IDからFANZA/MGSの詳細ページを再クロールして演者情報を取得
#
# 使用方法: bash scripts/deploy/run-enrich-performers.sh [--create-only] [--asp FANZA|MGS|SOKMIL]

PROJECT=adult-v
REGION=asia-northeast1  # 日本リージョン
IMAGE=us-central1-docker.pkg.dev/adult-v/adult-v-crawlers/crawler:latest
JOB_NAME="enrich-performers"

CREATE_ONLY=false
ASP=""
LIMIT=1000

for arg in "$@"; do
  case $arg in
    --create-only) CREATE_ONLY=true ;;
    --asp=*) ASP="${arg#*=}" ;;
    --limit=*) LIMIT="${arg#*=}" ;;
  esac
done

echo "=== 演者紐付け補填ジョブ ==="
echo "リージョン: $REGION"
echo "ASP: ${ASP:-全て}"
echo "上限: $LIMIT件"
echo "モード: $([ "$CREATE_ONLY" = true ] && echo "作成のみ" || echo "作成＆実行")"
echo ""

ARGS="tsx,packages/crawlers/src/enrichment/enrich-performers.ts,--limit=${LIMIT}"
if [ -n "$ASP" ]; then
  ARGS="${ARGS},--asp=${ASP}"
fi

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
