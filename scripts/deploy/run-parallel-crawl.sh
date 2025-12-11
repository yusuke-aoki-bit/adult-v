#!/bin/bash
# MGS & FANZA 並列クロールスクリプト（日本リージョン版）
# asia-northeast1で並列実行
#
# 使用方法: bash scripts/deploy/run-parallel-crawl.sh [--create-only] [--mgs-only] [--fanza-only]

PROJECT=adult-v
REGION=asia-northeast1  # 日本リージョン
IMAGE=us-central1-docker.pkg.dev/adult-v/adult-v-crawlers/crawler:latest

CREATE_ONLY=false
MGS_ONLY=false
FANZA_ONLY=false

for arg in "$@"; do
  case $arg in
    --create-only) CREATE_ONLY=true ;;
    --mgs-only) MGS_ONLY=true ;;
    --fanza-only) FANZA_ONLY=true ;;
  esac
done

echo "=== MGS & FANZA 並列クロール（日本リージョン） ==="
echo "リージョン: $REGION"
echo "モード: $([ "$CREATE_ONLY" = true ] && echo "作成のみ" || echo "作成＆実行")"
echo ""

# MGSシリーズ群（5並列に削減）
MGS_GROUPS=(
  # グループ1: プレステージ系
  "ABW,ABP,ABS,ABF,CHN,TEM,SGA,SABA,KBI,GAV,AOI,EDD,YRH"
  # グループ2: SODクリエイト系
  "STARS,SDAB,SDJS,SDDE,SDAM,SDMU,SDNT,SDNM,SDEN,SDMF,SDMM"
  # グループ3: JUFE/kawaii/ムーディーズ系
  "JUFE,JUSD,JUNY,CAWD,KAVR,KWBD,KAWD,MIAA,MIDE,MIRD,MIDD,MIMK,PRED"
  # グループ4: S1/アイデアポケット系
  "PPPD,SNIS,SSNI,SSIS,SONE,SIVR,OFJE,SOE,MSFH,IPX,IPZ,IPVR,SUPD,HODV"
  # グループ5: 素人/その他
  "261ARA,259LUXU,300MIUM,300MAAN,300NTK,261SIRO,FSDSS,FLNS,MFCS,GVH,JUL,ROE,MOND,MEYD"
)

# FANZAページ範囲（5並列）
FANZA_PAGE_RANGES=(
  "1,100"
  "101,200"
  "201,300"
  "301,400"
  "401,500"
)

# MGSジョブを作成/実行
create_mgs_job() {
  local INDEX=$1
  local SERIES=$2
  local JOB_NAME="mgs-parallel-${INDEX}"

  if gcloud run jobs describe $JOB_NAME --project=$PROJECT --region=$REGION &>/dev/null; then
    echo "[$JOB_NAME] 既存のジョブを更新"
    gcloud run jobs update $JOB_NAME \
      --project=$PROJECT \
      --region=$REGION \
      --image=$IMAGE \
      --task-timeout=21600 \
      --max-retries=1 \
      --memory=2Gi \
      --cpu=1 \
      --args="tsx,packages/crawlers/src/enrichment/crawl-mgs-list.ts,--full-scan,--series=${SERIES},--no-ai" \
      --set-secrets="DATABASE_URL=database-url:latest" \
      2>&1
  else
    echo "[$JOB_NAME] 新規ジョブを作成 (series: ${SERIES:0:30}...)"
    gcloud run jobs create $JOB_NAME \
      --project=$PROJECT \
      --region=$REGION \
      --image=$IMAGE \
      --task-timeout=21600 \
      --max-retries=1 \
      --memory=2Gi \
      --cpu=1 \
      --command="npx" \
      --args="tsx,packages/crawlers/src/enrichment/crawl-mgs-list.ts,--full-scan,--series=${SERIES},--no-ai" \
      --set-secrets="DATABASE_URL=database-url:latest" \
      2>&1
  fi

  if [ "$CREATE_ONLY" = false ]; then
    echo "[$JOB_NAME] 実行開始"
    gcloud run jobs execute $JOB_NAME --project=$PROJECT --region=$REGION --async &
  fi
}

# FANZAジョブを作成/実行
create_fanza_job() {
  local INDEX=$1
  local RANGE=$2
  local START_PAGE=$(echo $RANGE | cut -d',' -f1)
  local END_PAGE=$(echo $RANGE | cut -d',' -f2)
  local PAGES=$((END_PAGE - START_PAGE + 1))
  local JOB_NAME="fanza-parallel-${INDEX}"

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
      --args="tsx,packages/crawlers/src/products/crawl-fanza.ts,--start-page=${START_PAGE},--pages=${PAGES},--limit=5000,--no-ai" \
      --set-secrets="DATABASE_URL=database-url:latest" \
      2>&1
  else
    echo "[$JOB_NAME] 新規ジョブを作成 (pages: ${START_PAGE}-${END_PAGE})"
    gcloud run jobs create $JOB_NAME \
      --project=$PROJECT \
      --region=$REGION \
      --image=$IMAGE \
      --task-timeout=21600 \
      --max-retries=1 \
      --memory=4Gi \
      --cpu=2 \
      --command="npx" \
      --args="tsx,packages/crawlers/src/products/crawl-fanza.ts,--start-page=${START_PAGE},--pages=${PAGES},--limit=5000,--no-ai" \
      --set-secrets="DATABASE_URL=database-url:latest" \
      2>&1
  fi

  if [ "$CREATE_ONLY" = false ]; then
    echo "[$JOB_NAME] 実行開始"
    gcloud run jobs execute $JOB_NAME --project=$PROJECT --region=$REGION --async &
  fi
}

# MGSジョブを作成・実行
if [ "$FANZA_ONLY" = false ]; then
  echo ""
  echo "=== MGS クローラー (${#MGS_GROUPS[@]}並列) ==="
  for i in "${!MGS_GROUPS[@]}"; do
    INDEX=$((i + 1))
    create_mgs_job "$INDEX" "${MGS_GROUPS[$i]}"
    sleep 2
  done
fi

# FANZAジョブを作成・実行
if [ "$MGS_ONLY" = false ]; then
  echo ""
  echo "=== FANZA クローラー (${#FANZA_PAGE_RANGES[@]}並列) ==="
  for i in "${!FANZA_PAGE_RANGES[@]}"; do
    INDEX=$((i + 1))
    create_fanza_job "$INDEX" "${FANZA_PAGE_RANGES[$i]}"
    sleep 2
  done
fi

if [ "$CREATE_ONLY" = false ]; then
  echo ""
  echo "バックグラウンドジョブの完了を待機中..."
  wait
fi

echo ""
echo "=== 完了 ==="
if [ "$CREATE_ONLY" = true ]; then
  echo "ジョブの作成が完了しました。実行するには --create-only を外して再度実行してください。"
else
  echo "全ジョブの起動が完了しました"
  echo ""
  echo "進捗確認:"
  echo "  gcloud run jobs executions list --project=$PROJECT --region=$REGION"
fi
