#!/bin/bash
# GCSバケットのセットアップスクリプト
# 使用方法: bash scripts/setup-gcs-bucket.sh

set -e

# 設定
PROJECT_ID="${GOOGLE_CLOUD_PROJECT_ID:-adult-video-db}"
BUCKET_NAME="${GCS_RAW_DATA_BUCKET:-adult-v-raw-data}"
REGION="asia-northeast1"

echo "=== GCS Bucket Setup ==="
echo "Project: $PROJECT_ID"
echo "Bucket: $BUCKET_NAME"
echo "Region: $REGION"
echo ""

# プロジェクトを設定
echo "Setting project..."
gcloud config set project $PROJECT_ID

# バケットが存在するか確認
if gsutil ls -b gs://$BUCKET_NAME 2>/dev/null; then
    echo "Bucket gs://$BUCKET_NAME already exists"
else
    echo "Creating bucket gs://$BUCKET_NAME..."
    gsutil mb -p $PROJECT_ID -l $REGION -c STANDARD gs://$BUCKET_NAME
    echo "Bucket created successfully"
fi

# ライフサイクルポリシーを設定（90日後にNearlineに移行、365日後に削除）
echo ""
echo "Setting lifecycle policy..."
cat > /tmp/lifecycle.json << 'EOF'
{
  "rule": [
    {
      "action": {
        "type": "SetStorageClass",
        "storageClass": "NEARLINE"
      },
      "condition": {
        "age": 90,
        "matchesStorageClass": ["STANDARD"]
      }
    },
    {
      "action": {
        "type": "Delete"
      },
      "condition": {
        "age": 365
      }
    }
  ]
}
EOF
gsutil lifecycle set /tmp/lifecycle.json gs://$BUCKET_NAME
rm /tmp/lifecycle.json
echo "Lifecycle policy set"

# CORS設定（必要な場合）
echo ""
echo "Setting CORS policy..."
cat > /tmp/cors.json << 'EOF'
[
  {
    "origin": ["*"],
    "method": ["GET"],
    "responseHeader": ["Content-Type"],
    "maxAgeSeconds": 3600
  }
]
EOF
gsutil cors set /tmp/cors.json gs://$BUCKET_NAME
rm /tmp/cors.json
echo "CORS policy set"

# バケット情報を表示
echo ""
echo "=== Bucket Info ==="
gsutil ls -L -b gs://$BUCKET_NAME | head -20

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Environment variable to set:"
echo "  GCS_RAW_DATA_BUCKET=$BUCKET_NAME"
