#!/bin/bash

# DUGA画像取得バッチスクリプト
# 100件ずつ処理して、合計135,895件をカバー

DATABASE_URL="postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres"

# 総バッチ数: 135,895 / 100 = 1359バッチ (切り上げ)
TOTAL_BATCHES=1359

echo "🖼️  DUGA Image Batch Processor"
echo "======================================"
echo "Total batches: $TOTAL_BATCHES"
echo "Products per batch: 100"
echo "Total products: ~135,895"
echo "======================================"
echo ""

# 開始バッチ番号 (デフォルト: 0)
START_BATCH=${1:-0}

# 終了バッチ番号 (デフォルト: 全て)
END_BATCH=${2:-$TOTAL_BATCHES}

echo "Processing batches $START_BATCH to $END_BATCH"
echo ""

for i in $(seq $START_BATCH $((END_BATCH - 1))); do
  OFFSET=$((i * 100))

  echo "[$i/$TOTAL_BATCHES] Starting batch $i (offset $OFFSET)"

  DATABASE_URL="$DATABASE_URL" npx tsx scripts/crawlers/crawl-duga-images.ts --limit 100 --offset $OFFSET

  EXIT_CODE=$?

  if [ $EXIT_CODE -ne 0 ]; then
    echo "❌ Batch $i failed with exit code $EXIT_CODE"
    echo "Resuming from batch $i with:"
    echo "  bash scripts/run-duga-batches.sh $i $END_BATCH"
    exit $EXIT_CODE
  fi

  echo "✓ Batch $i completed"
  echo ""

  # バッチ間の待機時間 (5秒)
  if [ $i -lt $((END_BATCH - 1)) ]; then
    sleep 5
  fi
done

echo ""
echo "======================================"
echo "✅ All batches completed!"
echo "======================================"
