#!/bin/bash

# =============================================================================
# 古い Cloud Run Jobs ベースのスケジューラーを削除するスクリプト
#
# Web App API方式への移行に伴い、Cloud Run Jobs をターゲットとする
# 古いスケジューラーを削除する。
#
# 実行前に必ず確認:
#   gcloud scheduler jobs list --location=asia-northeast1
# =============================================================================

set -e

LOCATION="asia-northeast1"

echo "=== 古い Cloud Run Jobs スケジューラーの削除 ==="
echo ""
echo "⚠️  以下のスケジューラーを削除します。"
echo "    新しいWeb App API版スケジューラーは setup-all-schedulers.sh で作成してください。"
echo ""

# 削除対象: 実際にGCPに存在していた古いスケジューラー名（2026-02-15に削除済み）
OLD_SCHEDULERS=(
  # MGS並列スケジューラー
  "mgs-parallel-1-daily" "mgs-parallel-2-daily" "mgs-parallel-3-daily"
  "mgs-parallel-4-daily" "mgs-parallel-5-daily" "mgs-parallel-6-daily"
  "mgs-parallel-7-daily" "mgs-parallel-8-daily" "mgs-parallel-9-daily"
  "mgs-parallel-10-daily"
  # Cloud Run Jobs ターゲット
  "performer-tags-weekly" "crawl-avwiki-scheduler" "gsc-fetcher-daily"
  "fanza-daily-scheduler" "sitemap-submit-weekly" "crawl-tokyohot-scheduler"
  "generate-reviews-weekly" "crawl-duga-scheduler" "mgs-description-backfill-weekly"
  "crawl-sokmil-scheduler" "crawl-b10f-scheduler" "crawl-fc2-scheduler"
  "crawl-dti-all-daily" "crawl-sales-scheduler" "crawl-japanska-scheduler"
  "mgs-daily-scheduler" "extract-product-codes-daily"
  # 旧名のWeb App APIスケジューラー
  "backfill-images-daily" "backfill-videos-daily" "performer-pipeline-daily"
  "content-enrichment-daily" "seo-enhance-daily" "cleanup-weekly"
)

echo "対象: ${#OLD_SCHEDULERS[@]} 個のスケジューラー"
echo ""

read -p "削除を実行しますか? (y/N): " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
  echo "キャンセルしました。"
  exit 0
fi

echo ""
deleted=0
skipped=0

for name in "${OLD_SCHEDULERS[@]}"; do
  if gcloud scheduler jobs describe "$name" --location="$LOCATION" &>/dev/null; then
    echo "  削除中: $name"
    gcloud scheduler jobs delete "$name" --location="$LOCATION" --quiet
    ((deleted++))
  else
    echo "  スキップ（存在しない）: $name"
    ((skipped++))
  fi
done

echo ""
echo "=== 完了 ==="
echo "  削除: ${deleted} 個"
echo "  スキップ: ${skipped} 個"
echo ""
echo "次のステップ:"
echo "  bash scripts/deploy/setup-all-schedulers.sh"
