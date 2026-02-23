#!/bin/bash

# =============================================================================
# Cloud Scheduler セットアップスクリプト（Web App APIエンドポイント版）
#
# Cloud Run Jobs方式 → Web App APIエンドポイント方式に移行
# コスト削減: 別コンテナ起動不要、既存Web Appインスタンスで処理
# =============================================================================

set -e

PROJECT_ID="adult-v"
LOCATION="asia-northeast1"
SERVICE_ACCOUNT="646431984228-compute@developer.gserviceaccount.com"
# Firebase App Hosting の直接URL（OIDC audience にも使用）
WEB_APP_URL="https://adult-v--adult-v.asia-east1.hosted.app"

echo "=== Cloud Scheduler セットアップ（Web App API版） ==="
echo "ターゲット: ${WEB_APP_URL}/api/cron/*"
echo ""

# ヘルパー関数: GETエンドポイント用スケジューラーを作成/更新
setup_get_scheduler() {
  local name=$1
  local schedule=$2
  local endpoint=$3
  local description=$4
  local deadline=${5:-540}  # デフォルト540秒（5分+バッファ）

  local uri="${WEB_APP_URL}/api/cron/${endpoint}"

  echo "【${description}】"
  echo "  スケジュール: ${schedule} (JST)"
  echo "  URI: ${uri}"

  if gcloud scheduler jobs describe "$name" --location="$LOCATION" &>/dev/null; then
    echo "  既存のスケジューラーを更新..."
    gcloud scheduler jobs update http "$name" \
      --location="$LOCATION" \
      --schedule="$schedule" \
      --time-zone="Asia/Tokyo" \
      --uri="$uri" \
      --http-method=GET \
      --oidc-service-account-email="$SERVICE_ACCOUNT" \
      --oidc-token-audience="$WEB_APP_URL" \
      --attempt-deadline="${deadline}s" \
      --quiet
  else
    echo "  新規スケジューラー作成..."
    gcloud scheduler jobs create http "$name" \
      --location="$LOCATION" \
      --schedule="$schedule" \
      --time-zone="Asia/Tokyo" \
      --uri="$uri" \
      --http-method=GET \
      --oidc-service-account-email="$SERVICE_ACCOUNT" \
      --oidc-token-audience="$WEB_APP_URL" \
      --attempt-deadline="${deadline}s" \
      --quiet
  fi
  echo "  -> Done"
  echo ""
}

# ヘルパー関数: POSTエンドポイント用スケジューラーを作成/更新
setup_post_scheduler() {
  local name=$1
  local schedule=$2
  local endpoint=$3
  local description=$4
  local deadline=${5:-540}

  local uri="${WEB_APP_URL}/api/cron/${endpoint}"

  echo "【${description}】"
  echo "  スケジュール: ${schedule} (JST)"
  echo "  URI: ${uri}"

  if gcloud scheduler jobs describe "$name" --location="$LOCATION" &>/dev/null; then
    echo "  既存のスケジューラーを更新..."
    gcloud scheduler jobs update http "$name" \
      --location="$LOCATION" \
      --schedule="$schedule" \
      --time-zone="Asia/Tokyo" \
      --uri="$uri" \
      --http-method=POST \
      --oidc-service-account-email="$SERVICE_ACCOUNT" \
      --oidc-token-audience="$WEB_APP_URL" \
      --attempt-deadline="${deadline}s" \
      --quiet
  else
    echo "  新規スケジューラー作成..."
    gcloud scheduler jobs create http "$name" \
      --location="$LOCATION" \
      --schedule="$schedule" \
      --time-zone="Asia/Tokyo" \
      --uri="$uri" \
      --http-method=POST \
      --oidc-service-account-email="$SERVICE_ACCOUNT" \
      --oidc-token-audience="$WEB_APP_URL" \
      --attempt-deadline="${deadline}s" \
      --quiet
  fi
  echo "  -> Done"
  echo ""
}

# ========================================
# 1. クローラー（毎日・時間帯別に分散）
# ========================================
echo "========== クローラー =========="

# DTI系（9サイト、10分間隔・limit倍増）
setup_get_scheduler "crawl-dti-caribbeancom" \
  "0 1 * * *" \
  "crawl-dti?site=caribbeancom&limit=100" \
  "DTI カリビアンコム"

setup_get_scheduler "crawl-dti-caribbeancompr" \
  "10 1 * * *" \
  "crawl-dti?site=caribbeancompr&limit=100" \
  "DTI カリビアンコムプレミアム"

setup_get_scheduler "crawl-dti-1pondo" \
  "20 1 * * *" \
  "crawl-dti?site=1pondo&limit=100" \
  "DTI 一本道"

setup_get_scheduler "crawl-dti-heyzo" \
  "30 1 * * *" \
  "crawl-dti?site=heyzo&limit=100" \
  "DTI HEYZO"

setup_get_scheduler "crawl-dti-10musume" \
  "40 1 * * *" \
  "crawl-dti?site=10musume&limit=100" \
  "DTI 天然むすめ"

setup_get_scheduler "crawl-dti-pacopacomama" \
  "50 1 * * *" \
  "crawl-dti?site=pacopacomama&limit=100" \
  "DTI パコパコママ"

setup_get_scheduler "crawl-dti-x1x" \
  "0 2 * * *" \
  "crawl-dti?site=x1x&limit=100" \
  "DTI X1X"

setup_get_scheduler "crawl-dti-enkou55" \
  "10 2 * * *" \
  "crawl-dti?site=enkou55&limit=100" \
  "DTI ENKOU55"

setup_get_scheduler "crawl-dti-urekko" \
  "20 2 * * *" \
  "crawl-dti?site=urekko&limit=100" \
  "DTI UREKKO"

# HEYDOUGA: 8時間間隔・limit倍増
setup_get_scheduler "crawl-heydouga" \
  "30 2,10,18 * * *" \
  "crawl-heydouga?limit=100" \
  "HEYDOUGA クローラー（スキャンモード・8h間隔）"

setup_get_scheduler "crawl-heydouga-homepage" \
  "0 4,16 * * *" \
  "crawl-heydouga?mode=homepage&limit=100" \
  "HEYDOUGA 新着（12h間隔）"

# MGS: 8時間間隔・limit倍増
setup_get_scheduler "crawl-mgs-scheduler" \
  "0 3,11,19 * * *" \
  "crawl-mgs?limit=200" \
  "MGS クローラー（8h間隔）"

# DUGA: auto-resume + ページネーションループ（4時間間隔に短縮）
setup_get_scheduler "crawl-duga-scheduler" \
  "0 1,5,9,13,17,21 * * *" \
  "crawl-duga" \
  "DUGA クローラー（auto-resume・4h間隔）"

# SOKMIL: auto-resume + ページネーションループ（4時間間隔に短縮）
setup_get_scheduler "crawl-sokmil-scheduler" \
  "0 2,6,10,14,18,22 * * *" \
  "crawl-sokmil" \
  "SOKMIL APIクローラー（auto-resume・4h間隔）"

# Japanska: 12時間間隔・limit倍増
setup_get_scheduler "crawl-japanska-scheduler" \
  "0 9,21 * * *" \
  "crawl-japanska?limit=200" \
  "Japanska クローラー（12h間隔）"

# b10f: 12時間間隔
setup_get_scheduler "crawl-b10f-scheduler" \
  "0 11,23 * * *" \
  "crawl-b10f" \
  "b10f クローラー（12h間隔）"

# FANZA: 4時間間隔・limit倍増
setup_get_scheduler "crawl-fanza-scheduler" \
  "0 1,5,9,13,17,21 * * *" \
  "crawl-fanza?limit=60" \
  "FANZA クローラー（auto-resume・4h間隔）"

# FC2: 4時間間隔・limit倍増
setup_get_scheduler "crawl-fc2-scheduler" \
  "0 2,6,10,14,18,22 * * *" \
  "crawl-fc2?limit=200" \
  "FC2 クローラー（auto-resume・4h間隔）"

# セール情報クローラー: 12時間間隔
setup_get_scheduler "crawl-sales-scheduler" \
  "0 0,12 * * *" \
  "crawl-sales" \
  "セール情報クローラー（12h間隔）"

# ========================================
# 2. エンリッチメント（クローラー後に実行）
# ========================================
echo "========== エンリッチメント =========="

# Raw Data処理（6時間ごと・limit倍増 - 更新頻度UP）
setup_get_scheduler "process-raw-data-scheduler" \
  "0 3,9,15,21 * * *" \
  "process-raw-data?limit=1000" \
  "Raw Data 処理（6時間ごと）"

# 演者パイプライン（毎日15:00 - 30分タイムアウト・limit倍増）
setup_get_scheduler "performer-pipeline-scheduler" \
  "0 15 * * *" \
  "performer-pipeline?limit=1000" \
  "演者紐づけパイプライン" \
  1800  # Cloud Scheduler上限の30分

# コンテンツエンリッチメント（12時間間隔・limit倍増）
setup_get_scheduler "content-enrichment-scheduler" \
  "0 4,16 * * *" \
  "content-enrichment-pipeline?limit=200&phases=translation,seo,performer" \
  "コンテンツエンリッチメント（12h間隔）"

# 演者名寄せ（12時間間隔・limit倍増）
setup_get_scheduler "normalize-performers-scheduler" \
  "0 5,17 * * *" \
  "normalize-performers?limit=200" \
  "演者名寄せ（12h間隔）"

# コンテンツ強化（12時間間隔・limit増加）
setup_get_scheduler "enhance-content-scheduler" \
  "0 6,18 * * *" \
  "enhance-content?limit=50" \
  "コンテンツ強化（12h間隔）"

# SEO強化（12時間間隔・limit倍増）
setup_get_scheduler "seo-enhance-scheduler" \
  "0 7,19 * * *" \
  "seo-enhance?type=indexing&limit=200" \
  "SEO強化・インデックス申請（12h間隔）"

# ========================================
# 3. バックフィル（日次/週次）
# ========================================
echo "========== バックフィル =========="

# 動画バックフィル（12時間間隔・limit倍増）
setup_get_scheduler "backfill-videos-scheduler" \
  "0 8,20 * * *" \
  "backfill-videos?limit=100" \
  "動画バックフィル（12h間隔）"

# 画像バックフィル（12時間間隔・limit倍増）
setup_get_scheduler "backfill-images-scheduler" \
  "0 9,21 * * *" \
  "backfill-images?limit=100" \
  "画像バックフィル（12h間隔）"

# 演者プロフィールバックフィル（週2回 水日3:00・limit倍増）
setup_get_scheduler "backfill-performer-profiles-weekly" \
  "0 3 * * 0,3" \
  "backfill-performer-profiles?limit=200&minProducts=5" \
  "演者プロフィールバックフィル（週2回）"

# レビューバックフィル（週2回 水日5:00・limit倍増）
setup_get_scheduler "backfill-reviews-weekly" \
  "0 5 * * 0,3" \
  "backfill-reviews?limit=100" \
  "レビューバックフィル（週2回）"

# 演者ルックアップ（週2回 水日7:00・limit倍増）
setup_get_scheduler "crawl-performer-lookup-weekly" \
  "0 7 * * 0,3" \
  "crawl-performer-lookup?limit=400" \
  "演者ルックアップ（週2回）"

# ========================================
# 4. メンテナンス・通知
# ========================================
echo "========== メンテナンス・通知 =========="

# データクリーンアップ（毎日23:00）
setup_get_scheduler "cleanup-scheduler" \
  "0 23 * * *" \
  "cleanup" \
  "データクリーンアップ"

# ISRキャッシュ再検証（4時間ごと - クローラー完了後にトップ/リスト系をrevalidate）
setup_get_scheduler "revalidate-scheduler" \
  "30 3,7,11,15,19,23 * * *" \
  "revalidate" \
  "ISRキャッシュ再検証（4h間隔）" \
  120

# IndexNow通知（4時間ごと - 更新頻度UP）
setup_post_scheduler "indexnow-notify-scheduler" \
  "0 0,4,8,12,16,20 * * *" \
  "indexnow-notify" \
  "IndexNow 自動通知（4時間ごと）" \
  120

# ニュース自動生成（毎日0:30）
setup_get_scheduler "generate-news-scheduler" \
  "30 0 * * *" \
  "generate-news" \
  "ニュース自動生成（毎日）"

# データ品質レポート（週1回 月曜4:00）
setup_get_scheduler "data-quality-report-weekly" \
  "0 4 * * 1" \
  "data-quality-report" \
  "データ品質レポート（週次）"

# ========================================
# 結果表示
# ========================================
echo ""
echo "=== 全スケジューラー一覧 ==="
gcloud scheduler jobs list --location="$LOCATION" \
  --format="table(name,schedule,state,httpTarget.uri)" \
  2>/dev/null || echo "一覧の取得に失敗しました"

echo ""
echo "=== セットアップ完了 ==="
echo ""
echo "手動実行テスト:"
echo "  gcloud scheduler jobs run crawl-mgs-scheduler --location=${LOCATION}"
echo ""
echo "ジョブの一時停止:"
echo "  gcloud scheduler jobs pause <JOB_NAME> --location=${LOCATION}"
echo ""
echo "ジョブの再開:"
echo "  gcloud scheduler jobs resume <JOB_NAME> --location=${LOCATION}"
