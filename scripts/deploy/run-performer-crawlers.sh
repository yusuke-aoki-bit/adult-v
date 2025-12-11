#!/bin/bash
# 演者情報クローラー並列実行スクリプト
# av-wiki, seesaawiki, shiroutoname, minnano-av を並列クロール
#
# 使用方法: bash scripts/deploy/run-performer-crawlers.sh [--create-only]

PROJECT=adult-v
REGION=us-central1
IMAGE=us-central1-docker.pkg.dev/adult-v/adult-v-crawlers/crawler:latest

CREATE_ONLY=false

for arg in "$@"; do
  case $arg in
    --create-only) CREATE_ONLY=true ;;
  esac
done

echo "=== 演者情報クローラー並列実行 ==="
echo "モード: $([ "$CREATE_ONLY" = true ] && echo "作成のみ" || echo "作成＆実行")"
echo ""

# ジョブ作成/更新/実行関数
create_or_update_job() {
  local JOB_NAME=$1
  local ARGS=$2
  local MEMORY=${3:-2Gi}
  local CPU=${4:-1}

  # ジョブが存在するか確認
  if gcloud run jobs describe $JOB_NAME --project=$PROJECT --region=$REGION &>/dev/null; then
    echo "[$JOB_NAME] 既存のジョブを更新"
    gcloud run jobs update $JOB_NAME \
      --project=$PROJECT \
      --region=$REGION \
      --image=$IMAGE \
      --task-timeout=21600 \
      --max-retries=1 \
      --memory=$MEMORY \
      --cpu=$CPU \
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
      --memory=$MEMORY \
      --cpu=$CPU \
      --command="npx" \
      --args="$ARGS" \
      --set-secrets="DATABASE_URL=database-url:latest" \
      2>&1
  fi

  if [ "$CREATE_ONLY" = false ]; then
    echo "[$JOB_NAME] 実行開始"
    gcloud run jobs execute $JOB_NAME --project=$PROJECT --region=$REGION &
  fi
}

echo ""
echo "=== 演者Wiki クローラー ==="

# 1. av-wiki.net 全ページクロール (品番→出演者マッピング)
create_or_update_job "wiki-av-wiki-all" \
  "tsx,packages/crawlers/src/performers/crawl-wiki-performers.ts,av-wiki-all,5000" \
  "2Gi" "1"
sleep 2

# 2. seesaawiki.jp/av_neme 全ページクロール (9,538件)
create_or_update_job "wiki-seesaawiki-all" \
  "tsx,packages/crawlers/src/performers/crawl-wiki-performers.ts,seesaawiki-all,10000" \
  "2Gi" "1"
sleep 2

# 3. shiroutoname.com 全ページクロール (素人系特化)
create_or_update_job "wiki-shiroutoname-all" \
  "tsx,packages/crawlers/src/performers/crawl-wiki-performers.ts,shiroutoname-all,10000" \
  "2Gi" "1"
sleep 2

# 4. FC2ブログクローラー (カリビアンコム/一本道系)
create_or_update_job "wiki-fc2-blog" \
  "tsx,packages/crawlers/src/performers/crawl-wiki-performers.ts,fc2-blog,5000" \
  "2Gi" "1"
sleep 2

echo ""
echo "=== minnano-av.com 演者クローラー ==="

# minnano-av.com から演者マスタを収集 (24,000件以上)
create_or_update_job "minnano-av-performers" \
  "tsx,packages/crawlers/src/performers/crawl-minnano-av-performers.ts,--limit=5000,--detail" \
  "2Gi" "1"
sleep 2

echo ""
echo "=== wiki_crawl_data 反映処理 ==="

# wiki_crawl_dataを product_performers に反映
create_or_update_job "wiki-process-data" \
  "tsx,packages/crawlers/src/performers/crawl-wiki-performers.ts,--process,50000" \
  "2Gi" "1"
sleep 2

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
