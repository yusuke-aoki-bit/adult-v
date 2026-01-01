#!/bin/bash
# Cloud Run Job作成用テンプレート
# VPCネットワーク設定を忘れずに含める

set -e

# 使い方
usage() {
  echo "Usage: $0 <job-name> <script-path> [options]"
  echo ""
  echo "Arguments:"
  echo "  job-name     Cloud Run Jobの名前"
  echo "  script-path  実行するスクリプトのパス (packages/crawlers/src/...)"
  echo ""
  echo "Options:"
  echo "  --limit N    処理件数の上限 (default: 1000)"
  echo "  --memory M   メモリ (default: 2Gi)"
  echo "  --cpu C      CPU (default: 1)"
  echo "  --timeout T  タイムアウト秒 (default: 3600)"
  echo ""
  echo "Example:"
  echo "  $0 my-job packages/crawlers/src/enrichment/my-script.ts --limit 500"
  exit 1
}

if [ $# -lt 2 ]; then
  usage
fi

JOB_NAME=$1
SCRIPT_PATH=$2
shift 2

# デフォルト値
LIMIT=1000
MEMORY="2Gi"
CPU="1"
TIMEOUT="3600"

# オプション解析
while [[ $# -gt 0 ]]; do
  case $1 in
    --limit)
      LIMIT="$2"
      shift 2
      ;;
    --memory)
      MEMORY="$2"
      shift 2
      ;;
    --cpu)
      CPU="$2"
      shift 2
      ;;
    --timeout)
      TIMEOUT="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      usage
      ;;
  esac
done

PROJECT="adult-v"
REGION="asia-northeast1"
IMAGE="asia-northeast1-docker.pkg.dev/adult-v/cloud-run-source-deploy/crawlers:latest"

echo "Creating Cloud Run Job: $JOB_NAME"
echo "  Script: $SCRIPT_PATH"
echo "  Limit: $LIMIT"
echo "  Memory: $MEMORY"
echo "  CPU: $CPU"
echo "  Timeout: ${TIMEOUT}s"
echo ""

gcloud run jobs create "$JOB_NAME" \
  --project="$PROJECT" \
  --region="$REGION" \
  --image="$IMAGE" \
  --command="npx" \
  --args="tsx,$SCRIPT_PATH,--limit=$LIMIT" \
  --set-secrets="DATABASE_URL=database-url:latest" \
  --memory="$MEMORY" \
  --cpu="$CPU" \
  --task-timeout="${TIMEOUT}s" \
  --max-retries=1 \
  --network=default \
  --subnet=default \
  --vpc-egress=private-ranges-only

echo ""
echo "✅ Job created successfully!"
echo ""
echo "To execute:"
echo "  gcloud run jobs execute $JOB_NAME --project=$PROJECT --region=$REGION"
