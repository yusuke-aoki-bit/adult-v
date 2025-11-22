# クローラーセットアップガイド

## 概要

このプロジェクトは複数のアダルト動画サイトから商品情報をクロールし、データベースに保存します。

**対応サイト:**
- MGS (https://www.mgstage.com)
- カリビアンコム (https://www.caribbeancom.com)
- HEYZO (https://www.heyzo.com)
- カリビアンコムプレミアム (https://www.caribbeancompr.com)
- 一本道 (https://www.1pondo.tv)

## ローカル実行

### 前提条件
```bash
export DATABASE_URL="postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres"
```

### MGSクローラー
```bash
# 2ページ分クロール（約60商品）
npx tsx scripts/crawl-mgs-list.ts "https://www.mgstage.com/search/cSearch.php?sort=new&disp_type=3" --max-pages 2

# 10ページ分クロール（約300商品）
npx tsx scripts/crawl-mgs-list.ts "https://www.mgstage.com/search/cSearch.php?sort=new&disp_type=3" --max-pages 10
```

### カリビアンコムクローラー
```bash
# 50件クロール
npx tsx scripts/crawl-dti-sites.ts --site caribbeancom --start "122024_001" --limit 50

# 100件クロール
npx tsx scripts/crawl-dti-sites.ts --site caribbeancom --start "122024_001" --limit 100
```

### HEYZOクローラー
```bash
npx tsx scripts/crawl-dti-sites.ts --site heyzo --start "0001" --limit 100
```

### 統一インターフェース（run-crawler.ts）
```bash
# MGS
npx tsx scripts/run-crawler.ts mgs --pages 10

# カリビアンコム
npx tsx scripts/run-crawler.ts caribbeancom --limit 100

# HEYZO
npx tsx scripts/run-crawler.ts heyzo --limit 50

# カリビアンコムプレミアム
npx tsx scripts/run-crawler.ts caribbeancompr --limit 100

# 一本道
npx tsx scripts/run-crawler.ts 1pondo --limit 100

# DUGA
npx tsx scripts/run-crawler.ts duga
```

## Google Cloud Run Jobsでの定期実行

### 1. デプロイ

```bash
cd "C:\Users\yuuku\cursor\adult-v"
bash scripts/deploy-crawler-jobs.sh
```

このスクリプトは以下を実行します：
1. Dockerイメージをビルド&プッシュ
2. Cloud Run Jobsを作成
   - `mgs-crawler`: 毎日2:00 AM JST（20ページ = 約600商品/日）
   - `caribbeancom-crawler`: 毎日3:00 AM JST（100件/日）
   - `heyzo-crawler`: 毎日4:00 AM JST（50件/日）
   - `caribbeancompr-crawler`: 毎日5:00 AM JST（100件/日）
   - `1pondo-crawler`: 毎日6:00 AM JST（100件/日）
   - `duga-crawler`: 毎日7:00 AM JST（全商品更新）
3. Cloud Schedulerで自動実行設定

### 2. 手動実行

```bash
# MGSクローラーを今すぐ実行
gcloud run jobs execute mgs-crawler --region us-central1

# カリビアンコムクローラーを今すぐ実行
gcloud run jobs execute caribbeancom-crawler --region us-central1

# HEYZOクローラーを今すぐ実行
gcloud run jobs execute heyzo-crawler --region us-central1

# カリビアンコムプレミアムクローラーを今すぐ実行
gcloud run jobs execute caribbeancompr-crawler --region us-central1

# 一本道クローラーを今すぐ実行
gcloud run jobs execute 1pondo-crawler --region us-central1

# DUGAクローラーを今すぐ実行
gcloud run jobs execute duga-crawler --region us-central1
```

### 3. ログ確認

```bash
# 最新の実行ログを確認
gcloud logging read "resource.type=cloud_run_job AND resource.labels.job_name=mgs-crawler" --limit 50 --format json

# リアルタイムログ監視
gcloud logging tail "resource.type=cloud_run_job"
```

### 4. スケジュール変更

```bash
# MGSクローラーを毎日1:00 AMに変更
gcloud scheduler jobs update http mgs-crawler-schedule \
  --location us-central1 \
  --schedule "0 1 * * *" \
  --time-zone "Asia/Tokyo"
```

## データ収集量の見積もり

### 日次収集量（デフォルト設定）
- MGS: 約600商品/日（20ページ × 30商品/ページ）
- カリビアンコム: 100商品/日
- HEYZO: 50商品/日
- カリビアンコムプレミアム: 100商品/日
- 一本道: 100商品/日
- DUGA: 全商品更新（差分のみ）
- **合計: 約950商品/日 + DUGA差分**

### 月次収集量
- **約28,500商品/月 + DUGA更新分**

### 収集データ
各商品につき以下を収集：
- ✅ **商品ID、タイトル**
- ✅ **出演者名（女優）**
- ✅ **リリース日**
- ✅ **サムネイル画像URL**
- ✅ **アフィリエイトリンク**（MGS: ウィジェット形式、DTI: clear-tv.com形式）
- ✅ **raw HTML**（将来の再処理用）

## トラブルシューティング

### エラー: "DATABASE_URL environment variable is not set"

環境変数が設定されていません：
```bash
export DATABASE_URL="postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres"
```

### エラー: "HTTP error! status: 403"

年齢確認Cookieが必要です。クローラーは自動で`adc=1`を送信しますが、サイトによってはブロックされる可能性があります。

### Cloud Run Jobsがタイムアウト

デフォルトは3600秒（1時間）です。より多くのページをクロールする場合は延長します：
```bash
gcloud run jobs update mgs-crawler \
  --region us-central1 \
  --task-timeout 7200s  # 2時間に延長
```

## コスト見積もり

### Cloud Run Jobs
- CPU: 2 vCPU
- メモリ: 2Gi
- 実行時間: 約30分/日/ジョブ × 3ジョブ = 90分/日
- **月額コスト: 約$5-10**

### Cloud Scheduler
- 3ジョブ × 30日 = 90実行/月
- **月額コスト: 無料枠内（3ジョブまで無料）**

### データベース（Cloud SQL）
- ストレージ増加: 約10GB/月（画像URLのみ、画像本体は別サーバー）
- **追加コスト: ほぼなし**

## 今後の拡張

### 新しいサイトの追加

1. `scripts/crawl-new-site.ts`を作成
2. `scripts/run-crawler.ts`にケースを追加
3. `scripts/deploy-crawler-jobs.sh`にジョブ定義を追加

### クロール頻度の調整

より多くのデータを収集するには：
```bash
# MGSを1日2回実行（朝・夜）
gcloud scheduler jobs create http mgs-crawler-evening \
  --schedule "0 20 * * *" \
  --time-zone "Asia/Tokyo" \
  ...
```

### データ品質チェック

定期的に以下を確認：
```sql
-- 最近のクロール状況
SELECT
  source,
  COUNT(*) as total,
  MAX(crawled_at) as last_crawl
FROM raw_html_data
GROUP BY source
ORDER BY last_crawl DESC;

-- アフィリエイトリンクが設定されているか
SELECT
  asp_name,
  COUNT(*) as total,
  COUNT(affiliate_url) as with_affiliate
FROM product_sources
GROUP BY asp_name;
```
