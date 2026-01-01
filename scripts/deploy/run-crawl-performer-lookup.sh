#!/bin/bash
# 演者ルックアップテーブルクローラー
# 外部Wikiサイトから品番→女優名マッピングを収集
#
# 使用方法: bash scripts/deploy/run-crawl-performer-lookup.sh [--create-only] [--source nakiny|minnano-av|av-wiki|av-sommelier]

PROJECT=adult-v
REGION=asia-northeast1
IMAGE=us-central1-docker.pkg.dev/adult-v/adult-v-crawlers/crawler:latest

CREATE_ONLY=false
SOURCE="nakiny"
START_PAGE=1
PAGES=100

for arg in "$@"; do
  case $arg in
    --create-only) CREATE_ONLY=true ;;
    --source=*) SOURCE="${arg#*=}" ;;
    --start=*) START_PAGE="${arg#*=}" ;;
    --pages=*) PAGES="${arg#*=}" ;;
  esac
done

JOB_NAME="crawl-lookup-${SOURCE}"

echo "=== 演者ルックアップクローラー ==="
echo "ソース: $SOURCE"
echo "開始ページ: $START_PAGE"
echo "ページ数: $PAGES"
echo "ジョブ名: $JOB_NAME"
echo "モード: $([ "$CREATE_ONLY" = true ] && echo "作成のみ" || echo "作成＆実行")"
echo ""

# curlでAPIを直接呼び出すスクリプトを作成
SCRIPT_CONTENT='
const source = process.env.SOURCE || "nakiny";
const startPage = parseInt(process.env.START_PAGE || "1", 10);
const pages = parseInt(process.env.PAGES || "100", 10);

async function main() {
  const baseUrl = process.env.API_URL || "https://adult-v-web.asia-northeast1.run.app";

  for (let page = startPage; page < startPage + pages; page += 10) {
    const batchPages = Math.min(10, startPage + pages - page);
    const url = `${baseUrl}/api/cron/crawl-performer-lookup?source=${source}&page=${page}&pages=${batchPages}`;

    console.log(`Crawling ${source} pages ${page}-${page + batchPages - 1}...`);

    try {
      const response = await fetch(url, {
        headers: {
          "x-cron-secret": process.env.CRON_SECRET || "",
        },
      });

      if (!response.ok) {
        console.error(`Error: ${response.status} ${response.statusText}`);
        continue;
      }

      const result = await response.json();
      console.log(`  Crawled: ${result.stats?.itemsCrawled || 0}, Inserted: ${result.stats?.itemsInserted || 0}`);

      // Rate limiting
      await new Promise(r => setTimeout(r, 5000));
    } catch (error) {
      console.error(`Error: ${error.message}`);
    }
  }

  console.log("Done!");
}

main();
'

# インラインスクリプトを実行
ARGS="node,-e,${SCRIPT_CONTENT}"

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
    --set-env-vars="SOURCE=${SOURCE},START_PAGE=${START_PAGE},PAGES=${PAGES}" \
    --set-secrets="DATABASE_URL=database-url:latest,CRON_SECRET=cron-secret:latest" \
    2>&1
else
  echo "[$JOB_NAME] 新規ジョブを作成"
  gcloud run jobs create $JOB_NAME \
    --project=$PROJECT \
    --region=$REGION \
    --image=$IMAGE \
    --task-timeout=21600 \
    --max-retries=1 \
    --memory=2Gi \
    --cpu=1 \
    --set-env-vars="SOURCE=${SOURCE},START_PAGE=${START_PAGE},PAGES=${PAGES}" \
    --set-secrets="DATABASE_URL=database-url:latest,CRON_SECRET=cron-secret:latest" \
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
