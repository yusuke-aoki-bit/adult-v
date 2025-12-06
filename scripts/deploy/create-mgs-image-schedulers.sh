#!/bin/bash

# MGS画像クローラーの並列スケジューラーを作成
# 5,000件の商品を10並列で処理（各500件ずつ）

for i in {0..9}; do
  offset=$((i * 500))

  echo "Creating scheduler mgs-image-parallel-$i (offset: $offset)..."

  gcloud scheduler jobs create http "mgs-image-parallel-$i" \
    --location=asia-northeast1 \
    --schedule="0 3 * * *" \
    --uri="https://asia-northeast1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/adult-v/jobs/mgs-image-crawler:run" \
    --http-method=POST \
    --oauth-service-account-email=646431984228-compute@developer.gserviceaccount.com \
    --message-body="{\"overrides\":{\"containerOverrides\":[{\"args\":[\"--limit\",\"500\",\"--offset\",\"$offset\"]}]}}" \
    --headers="Content-Type=application/json"

  if [ $? -eq 0 ]; then
    echo "✓ Created mgs-image-parallel-$i"
  else
    echo "✗ Failed to create mgs-image-parallel-$i"
  fi

  echo ""
done

echo "All MGS image schedulers created. Pausing them by default..."

for i in {0..9}; do
  gcloud scheduler jobs pause "mgs-image-parallel-$i" --location=asia-northeast1
done

echo "✓ All schedulers paused. Use 'gcloud scheduler jobs resume' to activate them."
