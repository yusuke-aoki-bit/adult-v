#!/bin/bash

# DUGA/MGSクローラーのスケジュールを1日1回に変更するスクリプト
# 全商品取得完了後に実行

set -e

LOCATION="asia-northeast1"

echo "=== DUGA/MGSクローラーのスケジュール変更 ==="
echo "5分ごと → 1日1回に変更"
echo ""

# 1. DUGA並列クローラーを一時停止して1日1回に変更
echo "【1】DUGA並列クローラー"
echo "変更: 5分ごと → 毎日1時"

# DUGA parallel-0のみ1日1回で実行、他は停止
for i in {0..9}; do
  if [ $i -eq 0 ]; then
    echo "  duga-parallel-0 を毎日1時に変更..."
    gcloud scheduler jobs update http duga-parallel-0 \
      --location=$LOCATION \
      --schedule="0 1 * * *" \
      --time-zone="Asia/Tokyo" 2>/dev/null && echo "  ✅ 更新完了" || echo "  ⚠️ 更新失敗"
  else
    echo "  duga-parallel-$i を停止..."
    gcloud scheduler jobs pause duga-parallel-$i --location=$LOCATION 2>/dev/null || echo "  既に停止中"
  fi
done

echo "✅ DUGAクローラー設定完了"
echo ""

# 2. MGS並列クローラーを一時停止して1日1回に変更
echo "【2】MGS並列クローラー"
echo "変更: 5分ごと → 毎日0時"

# MGS parallel-0のみ1日1回で実行、他は停止
for i in {0..9}; do
  if [ $i -eq 0 ]; then
    echo "  mgs-parallel-0 を毎日0時に変更..."
    gcloud scheduler jobs update http mgs-parallel-0 \
      --location=$LOCATION \
      --schedule="0 0 * * *" \
      --time-zone="Asia/Tokyo" 2>/dev/null && echo "  ✅ 更新完了" || echo "  ⚠️ 更新失敗"
  else
    echo "  mgs-parallel-$i を停止..."
    gcloud scheduler jobs pause mgs-parallel-$i --location=$LOCATION 2>/dev/null || echo "  既に停止中"
  fi
done

echo "✅ MGSクローラー設定完了"
echo ""

# 現在のスケジューラー状態を確認
echo "=== 更新後のスケジューラー状態 ==="
gcloud scheduler jobs list --location=$LOCATION --format="table(name,schedule,state)" | grep -E "(duga|mgs)" || echo "スケジューラーが見つかりません"

echo ""
echo "✅ スケジュール変更完了！"
echo ""
echo "新しいスケジュール:"
echo "  - DUGA: 毎日1:00 (parallel-0のみ)"
echo "  - MGS:  毎日0:00 (parallel-0のみ)"
