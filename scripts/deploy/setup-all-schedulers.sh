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

# DTI系（6サイト、10分間隔）
setup_get_scheduler "crawl-dti-caribbeancom" \
  "0 1 * * *" \
  "crawl-dti?site=caribbeancom&limit=50" \
  "DTI カリビアンコム"

setup_get_scheduler "crawl-dti-caribbeancompr" \
  "10 1 * * *" \
  "crawl-dti?site=caribbeancompr&limit=50" \
  "DTI カリビアンコムプレミアム"

setup_get_scheduler "crawl-dti-1pondo" \
  "20 1 * * *" \
  "crawl-dti?site=1pondo&limit=50" \
  "DTI 一本道"

setup_get_scheduler "crawl-dti-heyzo" \
  "30 1 * * *" \
  "crawl-dti?site=heyzo&limit=50" \
  "DTI HEYZO"

setup_get_scheduler "crawl-dti-10musume" \
  "40 1 * * *" \
  "crawl-dti?site=10musume&limit=50" \
  "DTI 天然むすめ"

setup_get_scheduler "crawl-dti-pacopacomama" \
  "50 1 * * *" \
  "crawl-dti?site=pacopacomama&limit=50" \
  "DTI パコパコママ"

# 単独クローラー（2時間間隔）
setup_get_scheduler "crawl-mgs-scheduler" \
  "0 3 * * *" \
  "crawl-mgs?limit=100" \
  "MGS クローラー"

setup_get_scheduler "crawl-duga-scheduler" \
  "0 5 * * *" \
  "crawl-duga?limit=100" \
  "DUGA クローラー"

setup_get_scheduler "crawl-sokmil-scheduler" \
  "0 7 * * *" \
  "crawl-sokmil?limit=100" \
  "SOKMIL APIクローラー"

setup_get_scheduler "crawl-japanska-scheduler" \
  "0 9 * * *" \
  "crawl-japanska" \
  "Japanska クローラー"

setup_get_scheduler "crawl-b10f-scheduler" \
  "0 11 * * *" \
  "crawl-b10f" \
  "b10f クローラー"

setup_get_scheduler "crawl-fc2-scheduler" \
  "0 13 * * *" \
  "crawl-fc2" \
  "FC2 クローラー"

# ========================================
# 2. エンリッチメント（クローラー後に実行）
# ========================================
echo "========== エンリッチメント =========="

# Raw Data処理（8時間ごと - コスト最適化）
setup_get_scheduler "process-raw-data-scheduler" \
  "0 2,10,18 * * *" \
  "process-raw-data?limit=500" \
  "Raw Data 処理（8時間ごと）"

# 演者パイプライン（毎日15:00 - 30分タイムアウト）
setup_get_scheduler "performer-pipeline-scheduler" \
  "0 15 * * *" \
  "performer-pipeline?limit=500" \
  "演者紐づけパイプライン" \
  1800  # Cloud Scheduler上限の30分

# コンテンツエンリッチメント（毎日16:00）
setup_get_scheduler "content-enrichment-scheduler" \
  "0 16 * * *" \
  "content-enrichment-pipeline?limit=100&phases=translation,seo,performer" \
  "コンテンツエンリッチメント"

# 演者名寄せ（毎日17:00）
setup_get_scheduler "normalize-performers-scheduler" \
  "0 17 * * *" \
  "normalize-performers?limit=100" \
  "演者名寄せ"

# コンテンツ強化（毎日18:00 - limit削減でAPI/実行コスト最適化）
setup_get_scheduler "enhance-content-scheduler" \
  "0 18 * * *" \
  "enhance-content?limit=30" \
  "コンテンツ強化"

# SEO強化（毎日19:00）
setup_get_scheduler "seo-enhance-scheduler" \
  "0 19 * * *" \
  "seo-enhance?type=indexing&limit=100" \
  "SEO強化・インデックス申請"

# ========================================
# 3. バックフィル（日次/週次）
# ========================================
echo "========== バックフィル =========="

# 動画バックフィル（毎日20:00）
setup_get_scheduler "backfill-videos-scheduler" \
  "0 20 * * *" \
  "backfill-videos?limit=50" \
  "動画バックフィル"

# 画像バックフィル（毎日21:00）
setup_get_scheduler "backfill-images-scheduler" \
  "0 21 * * *" \
  "backfill-images?limit=50" \
  "画像バックフィル"

# 演者プロフィールバックフィル（週1回 日曜3:00）
setup_get_scheduler "backfill-performer-profiles-weekly" \
  "0 3 * * 0" \
  "backfill-performer-profiles?limit=100&minProducts=5" \
  "演者プロフィールバックフィル（週次）"

# レビューバックフィル（週1回 日曜5:00）
setup_get_scheduler "backfill-reviews-weekly" \
  "0 5 * * 0" \
  "backfill-reviews?limit=50" \
  "レビューバックフィル（週次）"

# 演者ルックアップ（週1回 日曜7:00）
setup_get_scheduler "crawl-performer-lookup-weekly" \
  "0 7 * * 0" \
  "crawl-performer-lookup?limit=200" \
  "演者ルックアップ（週次）"

# ========================================
# 4. メンテナンス・通知
# ========================================
echo "========== メンテナンス・通知 =========="

# データクリーンアップ（毎日23:00）
setup_get_scheduler "cleanup-scheduler" \
  "0 23 * * *" \
  "cleanup" \
  "データクリーンアップ"

# IndexNow通知（6時間ごと - コスト最適化、新コンテンツ量的に十分）
setup_post_scheduler "indexnow-notify-scheduler" \
  "0 0,6,12,18 * * *" \
  "indexnow-notify" \
  "IndexNow 自動通知（6時間ごと）" \
  120  # 60秒タイムアウト + バッファ

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
