#!/bin/bash
# 大規模クロール用並列実行スクリプト
# 使用方法: bash scripts/deploy/parallel-crawl.sh
#
# オプション:
#   --create-only  ジョブの作成のみ（実行しない）
#   --duga-only    DUGAのみ実行
#   --sokmil-only  SOKMILのみ実行

PROJECT=adult-v
REGION=asia-northeast1
IMAGE=asia-northeast1-docker.pkg.dev/adult-v/cloud-run-source-deploy/crawlers:latest

CREATE_ONLY=false
DUGA_ONLY=false
SOKMIL_ONLY=false

for arg in "$@"; do
  case $arg in
    --create-only) CREATE_ONLY=true ;;
    --duga-only) DUGA_ONLY=true ;;
    --sokmil-only) SOKMIL_ONLY=true ;;
  esac
done

echo "=== 全クローラー並列実行スクリプト ==="
echo "モード: $([ "$CREATE_ONLY" = true ] && echo "作成のみ" || echo "作成＆実行")"
echo ""

# DUGA年別ジョブを作成/実行
create_duga_job() {
  local YEAR=$1
  local JOB_NAME="duga-${YEAR}"

  # ジョブが存在するか確認
  if gcloud run jobs describe $JOB_NAME --project=$PROJECT --region=$REGION &>/dev/null; then
    echo "[$JOB_NAME] 既存のジョブ"
  else
    echo "[$JOB_NAME] 新規ジョブを作成"
    gcloud run jobs create $JOB_NAME \
      --project=$PROJECT \
      --region=$REGION \
      --image=$IMAGE \
      --task-timeout=21600 \
      --max-retries=0 \
      --memory=2Gi \
      --cpu=1 \
      --command="npx" \
      --args="tsx,scripts/crawlers/crawl-duga-api.ts,--full-scan,--limit=999999,--year=$YEAR" \
      --set-secrets="DATABASE_URL=database-url:latest,GEMINI_API_KEY=gemini-api-key:latest,DUGA_APP_ID=duga-app-id:latest,DUGA_AGENT_ID=duga-agent-id:latest" \
      2>&1
  fi

  if [ "$CREATE_ONLY" = false ]; then
    echo "[$JOB_NAME] 実行開始"
    gcloud run jobs execute $JOB_NAME --project=$PROJECT --region=$REGION &
  fi
}

# SOKMIL年別ジョブを作成/実行
create_sokmil_job() {
  local YEAR=$1
  local JOB_NAME="sokmil-${YEAR}"

  # ジョブが存在するか確認
  if gcloud run jobs describe $JOB_NAME --project=$PROJECT --region=$REGION &>/dev/null; then
    echo "[$JOB_NAME] 既存のジョブ"
  else
    echo "[$JOB_NAME] 新規ジョブを作成"
    gcloud run jobs create $JOB_NAME \
      --project=$PROJECT \
      --region=$REGION \
      --image=$IMAGE \
      --task-timeout=21600 \
      --max-retries=0 \
      --memory=2Gi \
      --cpu=1 \
      --command="npx" \
      --args="tsx,scripts/crawlers/crawl-sokmil-api.ts,--full-scan,--limit=999999,--year=$YEAR" \
      --set-secrets="DATABASE_URL=database-url:latest,GEMINI_API_KEY=gemini-api-key:latest,SOKMIL_API_KEY=sokmil-api-key:latest" \
      2>&1
  fi

  if [ "$CREATE_ONLY" = false ]; then
    echo "[$JOB_NAME] 実行開始"
    gcloud run jobs execute $JOB_NAME --project=$PROJECT --region=$REGION &
  fi
}

# DUGAのみ指定されている場合、または指定なしの場合
if [ "$SOKMIL_ONLY" = false ]; then
  echo ""
  echo "=== DUGA クローラー (186K件) ==="
  echo "年別10並列で実行します"
  for YEAR in 2024 2023 2022 2021 2020 2019 2018 2017 2016 2015; do
    create_duga_job "$YEAR"
  done
fi

# SOKMILのみ指定されている場合、または指定なしの場合
if [ "$DUGA_ONLY" = false ]; then
  echo ""
  echo "=== SOKMIL クローラー (251K件) ==="
  echo "年別10並列で実行します"
  for YEAR in 2024 2023 2022 2021 2020 2019 2018 2017 2016 2015; do
    create_sokmil_job "$YEAR"
  done
fi

# 指定がない場合のみ他のクローラーも実行
if [ "$DUGA_ONLY" = false ] && [ "$SOKMIL_ONLY" = false ] && [ "$CREATE_ONLY" = false ]; then
  echo ""
  echo "=== MGS クローラー (40K件) ==="
  gcloud run jobs execute mgs-crawler --project=$PROJECT --region=$REGION &

  echo ""
  echo "=== その他のASP ==="
  gcloud run jobs execute heyzo-crawler --project=$PROJECT --region=$REGION &
  gcloud run jobs execute ippondo-crawler --project=$PROJECT --region=$REGION &
  gcloud run jobs execute caribbeancom-crawler --project=$PROJECT --region=$REGION &
  gcloud run jobs execute caribbeancompr-crawler --project=$PROJECT --region=$REGION &
  gcloud run jobs execute b10f-crawler --project=$PROJECT --region=$REGION &
  gcloud run jobs execute fc2-crawler --project=$PROJECT --region=$REGION &
fi

if [ "$CREATE_ONLY" = false ]; then
  wait
fi

echo ""
echo "=== 完了 ==="
if [ "$CREATE_ONLY" = true ]; then
  echo "ジョブの作成が完了しました。実行するには --create-only を外して再度実行してください。"
else
  echo "全ジョブの起動が完了しました"
fi
