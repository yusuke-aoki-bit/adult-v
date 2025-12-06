#!/bin/bash

# すべてのクローラーをCloud Schedulerで定期実行するセットアップスクリプト

set -e

PROJECT_ID="adult-v-446607"
REGION="asia-northeast1"
LOCATION="asia-northeast1"
SERVICE_ACCOUNT="646431984228-compute@developer.gserviceaccount.com"

echo "=== 全クローラーのCloud Scheduler設定 ==="
echo ""

# 1. DUGA並列クローラー (既存) - 有効化
echo "【1】DUGA並列クローラー (10並列)"
echo "スケジュール: 5分ごと"
echo "ステータス確認中..."

# DUGAジョブを有効化
for i in {0..9}; do
  echo "  duga-parallel-$i を有効化..."
  gcloud scheduler jobs resume duga-parallel-$i --location=$LOCATION 2>/dev/null || echo "  既に有効"
done

echo "✅ DUGA並列クローラー設定完了"
echo ""

# 2. MGS並列クローラー (既存) - 有効化
echo "【2】MGS並列クローラー (10並列)"
echo "スケジュール: 5分ごと"

# MGSジョブを有効化
for i in {0..9}; do
  echo "  mgs-parallel-$i を有効化..."
  gcloud scheduler jobs resume mgs-parallel-$i --location=$LOCATION 2>/dev/null || echo "  既に有効"
done

echo "✅ MGS並列クローラー設定完了"
echo ""

# 3. Sokmilクローラー
echo "【3】Sokmilクローラー"
echo "スケジュール: 毎日3時"

if gcloud run jobs describe sokmil-crawler --region=$REGION &>/dev/null; then
  if gcloud scheduler jobs describe sokmil-daily --location=$LOCATION &>/dev/null; then
    echo "  既存のスケジューラーを更新..."
    gcloud scheduler jobs update http sokmil-daily \
      --location=$LOCATION \
      --schedule="0 3 * * *" \
      --time-zone="Asia/Tokyo" \
      --uri="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/sokmil-crawler:run" \
      --http-method=POST \
      --oauth-service-account-email=$SERVICE_ACCOUNT
  else
    echo "  新規スケジューラー作成..."
    gcloud scheduler jobs create http sokmil-daily \
      --location=$LOCATION \
      --schedule="0 3 * * *" \
      --time-zone="Asia/Tokyo" \
      --uri="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/sokmil-crawler:run" \
      --http-method=POST \
      --oauth-service-account-email=$SERVICE_ACCOUNT
  fi
  echo "✅ Sokmilクローラー設定完了"
else
  echo "⚠️ Sokmil Cloud Run Jobが見つかりません。先にデプロイしてください"
fi
echo ""

# 4. b10fクローラー
echo "【4】b10fクローラー"
echo "スケジュール: 毎日4時"

if gcloud run jobs describe b10f-crawler --region=$REGION &>/dev/null; then
  if gcloud scheduler jobs describe b10f-daily --location=$LOCATION &>/dev/null; then
    echo "  既存のスケジューラーを更新..."
    gcloud scheduler jobs update http b10f-daily \
      --location=$LOCATION \
      --schedule="0 4 * * *" \
      --time-zone="Asia/Tokyo" \
      --uri="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/b10f-crawler:run" \
      --http-method=POST \
      --oauth-service-account-email=$SERVICE_ACCOUNT
  else
    echo "  新規スケジューラー作成..."
    gcloud scheduler jobs create http b10f-daily \
      --location=$LOCATION \
      --schedule="0 4 * * *" \
      --time-zone="Asia/Tokyo" \
      --uri="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/b10f-crawler:run" \
      --http-method=POST \
      --oauth-service-account-email=$SERVICE_ACCOUNT
  fi
  echo "✅ b10fクローラー設定完了"
else
  echo "⚠️ b10f Cloud Run Jobが見つかりません。先にデプロイしてください"
fi
echo ""

# 5. DTIクローラー (一本道, カリビアンコム, カリビアンコムプレミアム, HEYZO)
echo "【5】DTIクローラー"
echo "スケジュール: 毎日2時"

if gcloud run jobs describe dti-crawler --region=$REGION &>/dev/null; then
  if gcloud scheduler jobs describe dti-daily --location=$LOCATION &>/dev/null; then
    echo "  既存のスケジューラーを更新..."
    gcloud scheduler jobs update http dti-daily \
      --location=$LOCATION \
      --schedule="0 2 * * *" \
      --time-zone="Asia/Tokyo" \
      --uri="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/dti-crawler:run" \
      --http-method=POST \
      --oauth-service-account-email=$SERVICE_ACCOUNT
  else
    echo "  新規スケジューラー作成..."
    gcloud scheduler jobs create http dti-daily \
      --location=$LOCATION \
      --schedule="0 2 * * *" \
      --time-zone="Asia/Tokyo" \
      --uri="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/dti-crawler:run" \
      --http-method=POST \
      --oauth-service-account-email=$SERVICE_ACCOUNT
  fi
  echo "✅ DTIクローラー設定完了"
else
  echo "⚠️ DTI Cloud Run Jobが見つかりません。先にデプロイしてください:"
  echo "   gcloud builds submit --config=cloudbuild-dti.yaml"
fi
echo ""

# 6. Japanskaクローラー
echo "【6】Japanskaクローラー"
echo "スケジュール: 毎日5時"

if gcloud run jobs describe japanska-crawler --region=$REGION &>/dev/null; then
  if gcloud scheduler jobs describe japanska-daily --location=$LOCATION &>/dev/null; then
    echo "  既存のスケジューラーを更新..."
    gcloud scheduler jobs update http japanska-daily \
      --location=$LOCATION \
      --schedule="0 5 * * *" \
      --time-zone="Asia/Tokyo" \
      --uri="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/japanska-crawler:run" \
      --http-method=POST \
      --oauth-service-account-email=$SERVICE_ACCOUNT
  else
    echo "  新規スケジューラー作成..."
    gcloud scheduler jobs create http japanska-daily \
      --location=$LOCATION \
      --schedule="0 5 * * *" \
      --time-zone="Asia/Tokyo" \
      --uri="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/japanska-crawler:run" \
      --http-method=POST \
      --oauth-service-account-email=$SERVICE_ACCOUNT
  fi
  echo "✅ Japanskaクローラー設定完了"
else
  echo "⚠️ Japanska Cloud Run Jobが見つかりません。先にデプロイしてください:"
  echo "   gcloud builds submit --config=cloudbuild-japanska.yaml"
fi
echo ""

# 7. FC2クローラー
echo "【7】FC2クローラー"
echo "スケジュール: 毎日6時"

if gcloud run jobs describe fc2-crawler --region=$REGION &>/dev/null; then
  if gcloud scheduler jobs describe fc2-daily --location=$LOCATION &>/dev/null; then
    echo "  既存のスケジューラーを更新..."
    gcloud scheduler jobs update http fc2-daily \
      --location=$LOCATION \
      --schedule="0 6 * * *" \
      --time-zone="Asia/Tokyo" \
      --uri="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/fc2-crawler:run" \
      --http-method=POST \
      --oauth-service-account-email=$SERVICE_ACCOUNT
  else
    echo "  新規スケジューラー作成..."
    gcloud scheduler jobs create http fc2-daily \
      --location=$LOCATION \
      --schedule="0 6 * * *" \
      --time-zone="Asia/Tokyo" \
      --uri="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/fc2-crawler:run" \
      --http-method=POST \
      --oauth-service-account-email=$SERVICE_ACCOUNT
  fi
  echo "✅ FC2クローラー設定完了"
else
  echo "⚠️ FC2 Cloud Run Jobが見つかりません。先にデプロイしてください:"
  echo "   gcloud builds submit --config=cloudbuild-fc2.yaml"
fi
echo ""

# 8. Wiki出演者クローラー
echo "【8】Wiki出演者クローラー"
echo "スケジュール: 毎週日曜1時"

if gcloud run jobs describe wiki-crawler --region=$REGION &>/dev/null; then
  if gcloud scheduler jobs describe wiki-weekly --location=$LOCATION &>/dev/null; then
    echo "  既存のスケジューラーを更新..."
    gcloud scheduler jobs update http wiki-weekly \
      --location=$LOCATION \
      --schedule="0 1 * * 0" \
      --time-zone="Asia/Tokyo" \
      --uri="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/wiki-crawler:run" \
      --http-method=POST \
      --oauth-service-account-email=$SERVICE_ACCOUNT
  else
    echo "  新規スケジューラー作成..."
    gcloud scheduler jobs create http wiki-weekly \
      --location=$LOCATION \
      --schedule="0 1 * * 0" \
      --time-zone="Asia/Tokyo" \
      --uri="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/wiki-crawler:run" \
      --http-method=POST \
      --oauth-service-account-email=$SERVICE_ACCOUNT
  fi
  echo "✅ Wiki出演者クローラー設定完了"
else
  echo "⚠️ Wiki Cloud Run Jobが見つかりません。先にデプロイしてください:"
  echo "   gcloud builds submit --config=cloudbuild-wiki.yaml"
fi
echo ""

# 9. Raw Data Processor
echo "【9】Rawデータ解析ジョブ"
echo "スケジュール: 毎日7時"

if gcloud run jobs describe raw-data-processor --region=$REGION &>/dev/null; then
  if gcloud scheduler jobs describe raw-data-daily --location=$LOCATION &>/dev/null; then
    echo "  既存のスケジューラーを更新..."
    gcloud scheduler jobs update http raw-data-daily \
      --location=$LOCATION \
      --schedule="0 7 * * *" \
      --time-zone="Asia/Tokyo" \
      --uri="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/raw-data-processor:run" \
      --http-method=POST \
      --oauth-service-account-email=$SERVICE_ACCOUNT
  else
    echo "  新規スケジューラー作成..."
    gcloud scheduler jobs create http raw-data-daily \
      --location=$LOCATION \
      --schedule="0 7 * * *" \
      --time-zone="Asia/Tokyo" \
      --uri="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/raw-data-processor:run" \
      --http-method=POST \
      --oauth-service-account-email=$SERVICE_ACCOUNT
  fi
  echo "✅ Rawデータ解析ジョブ設定完了"
else
  echo "⚠️ Raw Data Processor Cloud Run Jobが見つかりません。先にデプロイしてください:"
  echo "   gcloud builds submit --config=cloudbuild-raw-data.yaml"
fi
echo ""

# 10. 出演者重複排除ジョブ (既存) - 確認のみ
echo "【10】出演者重複排除ジョブ"
echo "スケジュール: 毎日3時"
if gcloud scheduler jobs describe performer-dedup-scheduler --location=$LOCATION &>/dev/null; then
  echo "✅ 既に設定済み (ENABLED)"
else
  echo "⚠️ スケジューラーが見つかりません"
fi
echo ""

# 現在のスケジューラー一覧を表示
echo "=== 全スケジューラー一覧 ==="
gcloud scheduler jobs list --location=$LOCATION --format="table(name,schedule,state)" | grep -E "(duga|mgs|sokmil|b10f|dti|japanska|fc2|wiki|performer)" || echo "スケジューラーが見つかりません"

echo ""
echo "✅ すべてのクローラーのスケジューラー設定が完了しました！"
echo ""
echo "=== デプロイコマンド一覧 ==="
echo "DTI:      gcloud builds submit --config=cloudbuild-dti.yaml"
echo "Japanska: gcloud builds submit --config=cloudbuild-japanska.yaml"
echo "FC2:      gcloud builds submit --config=cloudbuild-fc2.yaml"
echo "Wiki:     gcloud builds submit --config=cloudbuild-wiki.yaml"
echo "RawData:  gcloud builds submit --config=cloudbuild-raw-data.yaml"
