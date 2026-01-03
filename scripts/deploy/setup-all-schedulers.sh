#!/bin/bash

# すべてのクローラーをCloud Schedulerで定期実行するセットアップスクリプト
# グループ化版 - 関連サイトをまとめて実行

set -e

PROJECT_ID="adult-v"
REGION="asia-northeast1"
LOCATION="asia-northeast1"
SERVICE_ACCOUNT="646431984228-compute@developer.gserviceaccount.com"

echo "=== 全クローラーのCloud Scheduler設定（グループ化版） ==="
echo ""

# ヘルパー関数: スケジューラーを作成/更新
setup_scheduler() {
  local name=$1
  local schedule=$2
  local job_name=$3
  local description=$4

  echo "【$description】"
  echo "スケジュール: $schedule (JST)"

  if gcloud run jobs describe $job_name --region=$REGION &>/dev/null; then
    if gcloud scheduler jobs describe $name --location=$LOCATION &>/dev/null; then
      echo "  既存のスケジューラーを更新..."
      gcloud scheduler jobs update http $name \
        --location=$LOCATION \
        --schedule="$schedule" \
        --time-zone="Asia/Tokyo" \
        --uri="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/${job_name}:run" \
        --http-method=POST \
        --oauth-service-account-email=$SERVICE_ACCOUNT
    else
      echo "  新規スケジューラー作成..."
      gcloud scheduler jobs create http $name \
        --location=$LOCATION \
        --schedule="$schedule" \
        --time-zone="Asia/Tokyo" \
        --uri="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/${job_name}:run" \
        --http-method=POST \
        --oauth-service-account-email=$SERVICE_ACCOUNT
    fi
    echo "✅ $description 設定完了"
  else
    echo "⚠️ Cloud Run Job '$job_name' が見つかりません。先にデプロイしてください"
  fi
  echo ""
}

# ========================================
# グループ化クローラー（複数サイトをまとめて実行）
# ========================================

# 1. DTI系（人妻）- h4610, h0930, c0930
setup_scheduler "crawl-dti-hitozuma-scheduler" "0 0 * * *" "crawl-dti-hitozuma" "DTI系（人妻）クローラー"

# 2. DTI系（カリビアン）- caribbean, caribbeancompr, 1pondo, heyzo, 10musume, pacopacomama
setup_scheduler "crawl-dti-caribbean-scheduler" "0 2 * * *" "crawl-dti-caribbean" "DTI系（カリビアン）クローラー"

# 3. FANZA
setup_scheduler "fanza-daily-scheduler" "0 4 * * *" "fanza-daily" "FANZAクローラー"

# 4. MGS
setup_scheduler "mgs-daily-scheduler" "0 5 * * *" "mgs-daily" "MGSクローラー"

# 5. TMP系 - heydouga, x1x, enkou55, urekko, xxxurabi
setup_scheduler "crawl-tmp-scheduler" "0 6 * * *" "crawl-tmp" "TMP系クローラー"

# 6. Tokyo-Hot系 - tokyohot, tvdeav
setup_scheduler "crawl-tokyohot-scheduler" "0 8 * * *" "crawl-tokyohot" "Tokyo-Hot系クローラー"

# 7. 新DTI系 - kin8tengoku, nyoshin, h0230
setup_scheduler "crawl-dti-new-scheduler" "0 10 * * *" "crawl-dti-new" "新DTI系クローラー"

# ========================================
# 単独クローラー（1サイトのみ）
# ========================================

# 8. DUGA
setup_scheduler "crawl-duga-scheduler" "0 12 * * *" "crawl-duga" "DUGAクローラー"

# 9. SOKMIL
setup_scheduler "crawl-sokmil-scheduler" "0 14 * * *" "crawl-sokmil" "SOKMILクローラー"

# 10. Japanska
setup_scheduler "crawl-japanska-scheduler" "0 16 * * *" "crawl-japanska" "Japanskaクローラー"

# 11. b10f
setup_scheduler "crawl-b10f-scheduler" "0 18 * * *" "crawl-b10f" "b10fクローラー"

# 12. FC2
setup_scheduler "crawl-fc2-scheduler" "0 20 * * *" "crawl-fc2" "FC2クローラー"

# 13. Sales（1日3回）
setup_scheduler "crawl-sales-scheduler" "0 8,14,20 * * *" "crawl-sales" "セールクローラー"

# ========================================
# エンリッチメントジョブ
# ========================================

# 14. 品番抽出（毎日23:00 - 全クローラー終了後）
setup_scheduler "extract-product-codes-daily" "0 23 * * *" "extract-product-codes" "品番抽出ジョブ"

# 15. 演者紐づけ（毎日23:30 - 品番抽出後）
setup_scheduler "performer-pipeline-daily" "30 23 * * *" "performer-pipeline" "演者紐づけパイプライン"

# 16. コンテンツエンリッチメント（毎日0:00 - 演者紐づけ後）
setup_scheduler "content-enrichment-daily" "0 0 * * *" "content-enrichment" "コンテンツエンリッチメント"

# 17. MGS description バックフィル（週1回）
setup_scheduler "mgs-description-backfill-weekly" "0 22 * * 0" "mgs-description-backfill" "MGS descriptionバックフィル"

# ========================================
# その他のジョブ
# ========================================

# 16. Wiki出演者クローラー（週1回）
setup_scheduler "wiki-weekly" "0 1 * * 0" "wiki-crawler" "Wiki出演者クローラー"

# 17. GSC Fetcher
setup_scheduler "gsc-fetcher-daily" "0 7 * * *" "gsc-fetcher" "GSC Fetcherジョブ"

# 18. PageSpeed Checker
setup_scheduler "pagespeed-checker-daily" "0 9 * * *" "pagespeed-checker" "PageSpeed Checkerジョブ"

# 19. Sitemap Submit（週1回）
setup_scheduler "sitemap-submit-weekly" "0 6 * * 0" "sitemap-submit" "サイトマップ送信ジョブ"

# 現在のスケジューラー一覧を表示
echo ""
echo "=== 全スケジューラー一覧 ==="
gcloud scheduler jobs list --location=$LOCATION --format="table(name,schedule,state)" | grep -E "(crawl|fanza|mgs|wiki|gsc|pagespeed|sales|sitemap)" || echo "スケジューラーが見つかりません"

echo ""
echo "✅ すべてのクローラーのスケジューラー設定が完了しました！"
echo ""
echo "=== デプロイコマンド一覧 ==="
echo "DTI-Caribbean: gcloud builds submit --config=cloudbuild-dti-caribbean.yaml"
echo "DTI-Hitozuma:  gcloud builds submit --config=cloudbuild-dti-hitozuma.yaml"
echo "DTI-New:       gcloud builds submit --config=cloudbuild-dti-new.yaml"
echo "TMP:           gcloud builds submit --config=cloudbuild-tmp.yaml"
echo "Tokyo-Hot:     gcloud builds submit --config=cloudbuild-tokyohot.yaml"
echo "Japanska:      gcloud builds submit --config=cloudbuild-japanska.yaml"
echo "FC2:           gcloud builds submit --config=cloudbuild-fc2.yaml"
echo "Wiki:          gcloud builds submit --config=cloudbuild-wiki.yaml"
