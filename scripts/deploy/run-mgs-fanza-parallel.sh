#!/bin/bash
# MGS & FANZA 並列クロールスクリプト
# 各10並列で補填率100%を目指す
#
# 使用方法: bash scripts/deploy/run-mgs-fanza-parallel.sh [--create-only] [--mgs-only] [--fanza-only]

PROJECT=adult-v
REGION=asia-northeast1
IMAGE=asia-northeast1-docker.pkg.dev/adult-v/cloud-run-source-deploy/crawlers:latest

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

echo "=== MGS & FANZA 並列クロールスクリプト ==="
echo "モード: $([ "$CREATE_ONLY" = true ] && echo "作成のみ" || echo "作成＆実行")"
echo ""

# MGSシリーズ群をグループに分割（10並列）
MGS_GROUPS=(
  # グループ1: プレステージ系
  "ABW,ABP,ABS,ABF,CHN,TEM,SGA,SABA"
  # グループ2: プレステージ系続き
  "KBI,GAV,AOI,EDD,YRH,SRS,MBM"
  # グループ3: SODクリエイト系
  "STARS,SDAB,SDJS,SDDE,SDAM"
  # グループ4: SODクリエイト続き
  "SDMU,SDNT,SDNM,SDEN,SDMF,SDMM"
  # グループ5: JUFE/kawaii系
  "JUFE,JUSD,JUNY,CAWD,KAVR,KWBD,KAWD"
  # グループ6: ムーディーズ系
  "MIAA,MIDE,MIRD,MIDD,MIMK,PRED"
  # グループ7: S1/PPPD系
  "PPPD,SNIS,SSNI,SSIS,SONE,SIVR"
  # グループ8: アイデアポケット系
  "OFJE,SOE,MSFH,IPX,IPZ,IPVR,SUPD,HODV"
  # グループ9: 素人系
  "261ARA,259LUXU,300MIUM,300MAAN,300NTK,261SIRO"
  # グループ10: その他
  "FSDSS,FLNS,MFCS,GVH,JUL,ROE,MOND,MEYD"
)

# FANZAページ範囲（各ジョブに50ページずつ割り当て、10並列で500ページ）
FANZA_PAGE_RANGES=(
  "1,50"
  "51,100"
  "101,150"
  "151,200"
  "201,250"
  "251,300"
  "301,350"
  "351,400"
  "401,450"
  "451,500"
)

# MGSジョブを作成/実行
create_mgs_job() {
  local INDEX=$1
  local SERIES=$2
  local JOB_NAME="mgs-parallel-${INDEX}"

  # ジョブが存在するか確認
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
    echo "[$JOB_NAME] 新規ジョブを作成 (series: ${SERIES})"
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
    gcloud run jobs execute $JOB_NAME --project=$PROJECT --region=$REGION &
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
    gcloud run jobs execute $JOB_NAME --project=$PROJECT --region=$REGION &
  fi
}

# MGSジョブを作成・実行
if [ "$FANZA_ONLY" = false ]; then
  echo ""
  echo "=== MGS クローラー (10並列) ==="
  for i in "${!MGS_GROUPS[@]}"; do
    INDEX=$((i + 1))
    create_mgs_job "$INDEX" "${MGS_GROUPS[$i]}"
    sleep 1
  done
fi

# FANZAジョブを作成・実行
if [ "$MGS_ONLY" = false ]; then
  echo ""
  echo "=== FANZA クローラー (10並列) ==="
  for i in "${!FANZA_PAGE_RANGES[@]}"; do
    INDEX=$((i + 1))
    create_fanza_job "$INDEX" "${FANZA_PAGE_RANGES[$i]}"
    sleep 1
  done
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
  echo ""
  echo "進捗確認:"
  echo "  gcloud run jobs executions list --project=$PROJECT --region=$REGION"
fi
