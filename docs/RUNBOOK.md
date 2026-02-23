# 運用ランブック (Operations Runbook)

## 目次

1. [システム概要](#システム概要)
2. [インシデント対応フロー](#1-インシデント対応フロー)
3. [ロールバック手順](#2-ロールバック手順)
4. [よくある障害と対処法](#3-よくある障害と対処法)
5. [定期メンテナンス](#4-定期メンテナンス)
6. [重要なコマンド集](#5-重要なコマンド集)
7. [連絡先・ダッシュボード](#6-連絡先ダッシュボード)

---

## システム概要

| 項目                     | 詳細                                                                               |
| ------------------------ | ---------------------------------------------------------------------------------- |
| **プロジェクト名**       | adult-v                                                                            |
| **GCP プロジェクト**     | `adult-v`                                                                          |
| **リージョン**           | `asia-east1` (Cloud SQL, VPC), `asia-northeast1` (Cloud Scheduler, Cloud Run Jobs) |
| **ランタイム**           | Node.js 20 (Next.js 16.0.7)                                                        |
| **パッケージマネージャ** | pnpm 9.15.0 + Turborepo                                                            |

### アプリケーション構成

| アプリ | Firebase Backend | 本番 URL                                         | SITE_MODE |
| ------ | ---------------- | ------------------------------------------------ | --------- |
| Web    | `adult-v`        | https://adult-v--adult-v.asia-east1.hosted.app   | `adult-v` |
| Fanza  | `adult-v-1`      | https://adult-v--adult-v-1.asia-east1.hosted.app | `fanza`   |

### インフラ構成図

```
[ユーザー] → [Firebase App Hosting (Cloud Run)] → [Cloud SQL PostgreSQL (asia-east1)]
                    ↓                                         ↑
              [Upstash Redis]                          [VPC Connector]
                                                    (adult-v-connector)

[Cloud Scheduler] → [Web App /api/cron/*] → [Cloud SQL]
[Cloud Build] → [Docker → Cloud Run Jobs (Crawler)]
[Sentry] ← エラー報告
```

### リソーススペック

| アプリ | CPU | メモリ   | 最小/最大インスタンス | 同時接続 |
| ------ | --- | -------- | --------------------- | -------- |
| Web    | 1   | 1792 MiB | 1 / 3                 | 40       |
| Fanza  | 1   | 1536 MiB | 1 / 2                 | 40       |

---

## 1. インシデント対応フロー

### 1.1 障害検知

障害の検知経路:

- **Sentry アラート**: エラー率の急増、新規エラーの検知
- **Google Cloud Monitoring**: Cloud Run のヘルスチェック、Cloud SQL の可用性
- **ユーザー報告**: SNS、問い合わせ
- **Cloud Scheduler 失敗通知**: cron ジョブの実行失敗

### 1.2 トリアージ (重大度判定)

| 重大度          | 定義               | 対応時間     | 例                               |
| --------------- | ------------------ | ------------ | -------------------------------- |
| **P0 (致命的)** | サイト全体がダウン | 即座         | 全ページ 5xx、DB 接続不能        |
| **P1 (重大)**   | 主要機能が利用不可 | 1時間以内    | 検索不能、商品ページ表示不可     |
| **P2 (中程度)** | 一部機能に影響     | 24時間以内   | キャッシュ不具合、クローラー停止 |
| **P3 (軽微)**   | 軽微な不具合       | 次回リリース | UI 崩れ、翻訳ミス                |

### 1.3 対応手順

```
1. 状況把握
   ├─ Sentry で影響範囲を確認
   ├─ Cloud Run ログでエラー内容を特定
   └─ 影響を受けているアプリ (Web / Fanza / 両方) を判定

2. 一次対応
   ├─ P0/P1: ロールバック検討 (→ セクション2参照)
   ├─ P2: 原因調査 → 修正コミット → 自動デプロイ
   └─ P3: Issue 作成 → 通常フローで対応

3. 恒久対応
   ├─ 根本原因の分析
   ├─ 修正の実装・レビュー
   └─ master へ push → 自動デプロイ

4. ポストモーテム (P0/P1 の場合)
   ├─ タイムライン作成
   ├─ 根本原因分析 (5 Whys)
   ├─ 再発防止策の策定
   └─ ドキュメント更新
```

### 1.4 ポストモーテム テンプレート

```markdown
## インシデント報告: [タイトル]

- 日時: YYYY-MM-DD HH:MM ~ HH:MM (JST)
- 重大度: P0/P1/P2
- 影響範囲: Web / Fanza / 両方
- 影響ユーザー数: 約 N 人

### タイムライン

- HH:MM 検知
- HH:MM 一次対応開始
- HH:MM 原因特定
- HH:MM 復旧確認

### 根本原因

(ここに記載)

### 対応内容

(ここに記載)

### 再発防止策

- [ ] (アクションアイテム)
```

---

## 2. ロールバック手順

### 2.1 Firebase App Hosting ロールバック

Firebase App Hosting は master への push で自動デプロイされる。ロールバックは以下の方法で行う。

#### 方法 A: Git revert で新しいデプロイを作成 (推奨)

```bash
# 問題のコミットを特定
git log --oneline -10

# revert コミットを作成
git revert <問題のコミットハッシュ>

# master に push → 自動デプロイが走る
git push origin master
```

#### 方法 B: Firebase App Hosting のロールバック一覧から選択

```bash
# Web バックエンドのロールアウト一覧を確認
gcloud run services describe adult-v \
  --region=asia-east1 \
  --format="value(status.traffic)"

# Fanza バックエンドのロールアウト一覧を確認
gcloud run services describe adult-v-1 \
  --region=asia-east1 \
  --format="value(status.traffic)"

# Firebase App Hosting のロールアウト一覧
gcloud firebase backends rollouts list \
  --project=adult-v \
  --backend=adult-v \
  --location=asia-east1

gcloud firebase backends rollouts list \
  --project=adult-v \
  --backend=adult-v-1 \
  --location=asia-east1
```

#### 方法 C: Cloud Run リビジョンへの直接トラフィック切り替え

```bash
# 利用可能なリビジョンを確認
gcloud run revisions list \
  --service=adult-v \
  --region=asia-east1 \
  --limit=10

# 特定のリビジョンにトラフィックを100%ルーティング
gcloud run services update-traffic adult-v \
  --region=asia-east1 \
  --to-revisions=<リビジョン名>=100
```

### 2.2 DB マイグレーション ロールバック

Drizzle ORM を使用。マイグレーションファイルは `./drizzle/` ディレクトリに格納。

**注意**: Drizzle Kit にはマイグレーションの自動ロールバック機能がない。手動で逆マイグレーション SQL を実行する必要がある。

```bash
# 現在のマイグレーション状態を確認
pnpm drizzle-kit check

# 直接 DB に接続して手動ロールバック
# Cloud SQL Auth Proxy 経由で接続
cloud-sql-proxy adult-v:asia-east1:<INSTANCE_NAME> &

# psql で接続し、逆マイグレーション SQL を手動実行
psql "$DATABASE_URL"

# 例: カラム追加を取り消す
# ALTER TABLE products DROP COLUMN IF EXISTS new_column;

# マイグレーション履歴テーブルからも該当レコードを削除
# DELETE FROM __drizzle_migrations WHERE hash = '<対象のハッシュ>';
```

**ロールバック前のチェックリスト**:

- [ ] ロールバック対象のマイグレーション内容を確認
- [ ] データ損失がないか確認 (DROP COLUMN 等)
- [ ] 本番 DB のバックアップを取得
- [ ] アプリケーションコードとの整合性を確認

---

## 3. よくある障害と対処法

### 3.1 5xx エラー急増

**症状**: Sentry にサーバーエラーが大量に報告される、ユーザーがページを開けない

**診断手順**:

```bash
# 1. Sentry でエラーの詳細を確認
# → https://sentry.io/organizations/avviewer-lab/issues/

# 2. Cloud Run ログを確認
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="adult-v" AND severity>=ERROR' \
  --limit=50 \
  --format="table(timestamp, textPayload)" \
  --project=adult-v

# Fanza の場合
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="adult-v-1" AND severity>=ERROR' \
  --limit=50 \
  --format="table(timestamp, textPayload)" \
  --project=adult-v

# 3. Cloud Run サービスの状態確認
gcloud run services describe adult-v --region=asia-east1 --format=yaml
gcloud run services describe adult-v-1 --region=asia-east1 --format=yaml

# 4. 直近のデプロイを確認 (デプロイ直後のエラーなら revert を検討)
git log --oneline -5
```

**対処法**:

- **デプロイ起因**: `git revert` して再デプロイ (セクション 2.1 参照)
- **一時的な負荷**: Cloud Run インスタンス数を一時的に増加
  ```bash
  gcloud run services update adult-v \
    --region=asia-east1 \
    --max-instances=5
  ```
- **メモリ不足**: メモリ上限を一時的に増加
  ```bash
  gcloud run services update adult-v \
    --region=asia-east1 \
    --memory=2Gi
  ```

### 3.2 DB 接続エラー

**症状**: `connection refused`、`too many connections`、`ECONNREFUSED`

**診断手順**:

```bash
# 1. Cloud SQL インスタンスの状態確認
gcloud sql instances describe <INSTANCE_NAME> \
  --project=adult-v \
  --format="table(state, settings.activationPolicy, connectionName)"

# 2. VPC コネクタの状態確認
gcloud compute networks vpc-access connectors describe adult-v-connector \
  --region=asia-east1 \
  --project=adult-v

# 3. Cloud SQL の接続数を確認
gcloud sql operations list \
  --instance=<INSTANCE_NAME> \
  --limit=10

# 4. Cloud SQL のログを確認
gcloud logging read \
  'resource.type="cloudsql_database" AND severity>=WARNING' \
  --limit=30 \
  --project=adult-v
```

**対処法**:

- **Cloud SQL が停止**: Cloud Console から再起動
  ```bash
  gcloud sql instances restart <INSTANCE_NAME> --project=adult-v
  ```
- **接続数上限**: connection pool の設定を確認、不要な接続を切断

  ```bash
  # psql で接続して確認
  SELECT count(*) FROM pg_stat_activity;
  SELECT * FROM pg_stat_activity WHERE state = 'idle';

  # idle 接続を切断
  SELECT pg_terminate_backend(pid) FROM pg_stat_activity
  WHERE state = 'idle' AND query_start < now() - interval '10 minutes';
  ```

- **VPC コネクタ障害**: コネクタの再作成が必要になる場合がある
  ```bash
  gcloud compute networks vpc-access connectors describe adult-v-connector \
    --region=asia-east1
  ```

### 3.3 Redis 接続エラー

**症状**: キャッシュミス率の上昇、レスポンス遅延、`UPSTASH_REDIS` 関連のエラー

**診断手順**:

```bash
# 1. Upstash ダッシュボードを確認
# → https://console.upstash.com/

# 2. Redis 接続テスト (curl で REST API を叩く)
curl -s "$UPSTASH_REDIS_REST_URL/ping" \
  -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN"
```

**対処法**:

- **Upstash 障害**: アプリケーションは自動的に in-memory LRU キャッシュにフォールバックする設計のため、即座の対応は不要。パフォーマンス低下は発生するが機能は維持される
- **レート制限**: Upstash の無料枠を超過している場合、プランのアップグレードを検討
- **認証エラー**: Secret Manager の `upstash-redis-url` と `upstash-redis-token` を確認
  ```bash
  gcloud secrets versions access latest --secret=upstash-redis-url --project=adult-v
  gcloud secrets versions access latest --secret=upstash-redis-token --project=adult-v
  ```

### 3.4 ビルド・デプロイ失敗

**症状**: master への push 後にデプロイが完了しない

**診断手順**:

```bash
# 1. Firebase App Hosting のビルドログ確認
gcloud firebase backends builds list \
  --project=adult-v \
  --backend=adult-v \
  --location=asia-east1 \
  --limit=5

gcloud firebase backends builds list \
  --project=adult-v \
  --backend=adult-v-1 \
  --location=asia-east1 \
  --limit=5

# 2. Cloud Build ログ確認
gcloud builds list --project=adult-v --limit=5
gcloud builds log <BUILD_ID> --project=adult-v

# 3. ローカルでビルド再現
pnpm install
pnpm build:web   # Web のビルド
pnpm build:fanza # Fanza のビルド
pnpm typecheck   # 型チェック
pnpm lint        # lint
```

**よくある原因と対処**:

- **型エラー**: `pnpm typecheck` でローカル確認、修正して再 push
- **依存関係エラー**: `pnpm install` が不完全 → `pnpm install --frozen-lockfile` を確認
- **メモリ不足**: ビルド時のメモリ上限に注意 (Next.js のビルドは大量のメモリを使用)
- **Secret 未設定**: `apphosting.yaml` で参照している Secret が Secret Manager に存在するか確認

### 3.5 クロール失敗

**症状**: Cloud Scheduler ジョブが FAILED、新規商品が追加されない

**診断手順**:

```bash
# 1. Cloud Scheduler のジョブ状態確認
gcloud scheduler jobs list --location=asia-northeast1 --project=adult-v

# 2. 特定のジョブの詳細・最終実行結果
gcloud scheduler jobs describe crawl-duga-scheduler --location=asia-northeast1
gcloud scheduler jobs describe crawl-mgs-scheduler --location=asia-northeast1

# 3. cron API エンドポイントのログ確認
gcloud logging read \
  'resource.type="cloud_run_revision" AND httpRequest.requestUrl:"/api/cron/"' \
  --limit=30 \
  --project=adult-v

# 4. Cloud Run Jobs のログ (Docker コンテナ型クローラーの場合)
gcloud logging read \
  'resource.type="cloud_run_job" AND resource.labels.job_name="duga-api-crawler"' \
  --limit=30 \
  --project=adult-v
```

**対処法**:

- **API レート制限**: `limit` パラメータを下げる、クローラーの実行間隔を広げる
- **認証エラー**: API キーの有効期限を確認 (DUGA, SOKMIL 等)
- **タイムアウト**: Cloud Scheduler のタイムアウト設定を確認
- **手動再実行**:
  ```bash
  gcloud scheduler jobs run crawl-mgs-scheduler --location=asia-northeast1
  ```
- **ジョブの一時停止/再開**:
  ```bash
  gcloud scheduler jobs pause <JOB_NAME> --location=asia-northeast1
  gcloud scheduler jobs resume <JOB_NAME> --location=asia-northeast1
  ```

---

## 4. 定期メンテナンス

### 4.1 毎日

| 項目               | 確認方法                                                |
| ------------------ | ------------------------------------------------------- |
| Sentry エラー確認  | Sentry ダッシュボードで新規エラーをレビュー             |
| クローラー実行結果 | `gcloud scheduler jobs list --location=asia-northeast1` |

### 4.2 毎週

| 項目                       | 確認方法                                                        |
| -------------------------- | --------------------------------------------------------------- |
| Cloud SQL バックアップ確認 | GCP Console → Cloud SQL → バックアップタブ                      |
| Cloud Run のリソース使用量 | GCP Console → Cloud Run → メトリクス                            |
| Upstash Redis 使用量       | Upstash Console でメモリ使用率・リクエスト数確認                |
| data-quality-report 確認   | 毎週月曜 04:00 JST に自動実行 (`/api/cron/data-quality-report`) |

### 4.3 毎月

| 項目                            | 確認方法                                       |
| ------------------------------- | ---------------------------------------------- |
| 依存関係の更新                  | `pnpm outdated` で確認、セキュリティパッチ優先 |
| GCP 請求確認                    | GCP Console → Billing                          |
| Secret Manager のローテーション | 必要に応じて API キーをローテーション          |
| Cloud SQL のストレージ使用量    | `gcloud sql instances describe <INSTANCE>`     |

### 4.4 DB バックアップ確認

```bash
# 自動バックアップの状態確認
gcloud sql instances describe <INSTANCE_NAME> \
  --project=adult-v \
  --format="table(settings.backupConfiguration)"

# バックアップ一覧
gcloud sql backups list --instance=<INSTANCE_NAME> --project=adult-v

# 手動バックアップの作成
gcloud sql backups create --instance=<INSTANCE_NAME> --project=adult-v
```

### 4.5 依存関係更新

```bash
# 依存関係の状態確認
pnpm outdated

# セキュリティ脆弱性の確認
pnpm audit

# 依存関係の更新 (パッチ/マイナーのみ)
pnpm update

# メジャーバージョンの更新 (慎重に)
pnpm update --latest

# 更新後の動作確認
pnpm typecheck
pnpm lint
pnpm test:run
pnpm build
```

---

## 5. 重要なコマンド集

### 5.1 gcloud コマンド

```bash
# === Cloud Run (Firebase App Hosting) ===

# サービス一覧
gcloud run services list --project=adult-v

# サービス詳細
gcloud run services describe adult-v --region=asia-east1
gcloud run services describe adult-v-1 --region=asia-east1

# ログ確認 (直近のエラー)
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="adult-v" AND severity>=ERROR' \
  --limit=20 --project=adult-v

# リビジョン一覧
gcloud run revisions list --service=adult-v --region=asia-east1 --limit=10

# === Cloud SQL ===

# インスタンス一覧
gcloud sql instances list --project=adult-v

# インスタンス詳細
gcloud sql instances describe <INSTANCE_NAME> --project=adult-v

# Cloud SQL Proxy (ローカル接続用)
cloud-sql-proxy adult-v:asia-east1:<INSTANCE_NAME>

# インスタンス再起動
gcloud sql instances restart <INSTANCE_NAME> --project=adult-v

# === Cloud Scheduler ===

# ジョブ一覧
gcloud scheduler jobs list --location=asia-northeast1 --project=adult-v

# 手動実行
gcloud scheduler jobs run <JOB_NAME> --location=asia-northeast1

# 一時停止 / 再開
gcloud scheduler jobs pause <JOB_NAME> --location=asia-northeast1
gcloud scheduler jobs resume <JOB_NAME> --location=asia-northeast1

# === Cloud Build ===

# ビルド一覧
gcloud builds list --project=adult-v --limit=10

# ビルドログ
gcloud builds log <BUILD_ID> --project=adult-v

# === Secret Manager ===

# シークレット一覧
gcloud secrets list --project=adult-v

# シークレットの値確認
gcloud secrets versions access latest --secret=<SECRET_NAME> --project=adult-v

# シークレットの更新
echo -n "新しい値" | gcloud secrets versions add <SECRET_NAME> --data-file=- --project=adult-v

# === VPC ===

# VPC コネクタ確認
gcloud compute networks vpc-access connectors describe adult-v-connector \
  --region=asia-east1 --project=adult-v

# === Firebase App Hosting ===

# バックエンド一覧
gcloud firebase backends list --project=adult-v

# ロールアウト一覧
gcloud firebase backends rollouts list \
  --project=adult-v --backend=adult-v --location=asia-east1
gcloud firebase backends rollouts list \
  --project=adult-v --backend=adult-v-1 --location=asia-east1
```

### 5.2 pnpm / Turborepo コマンド

```bash
# === 開発 ===

pnpm dev          # 全アプリ起動
pnpm dev:web      # Web のみ起動
pnpm dev:fanza    # Fanza のみ起動

# === ビルド ===

pnpm build        # 全アプリビルド
pnpm build:web    # Web のみビルド
pnpm build:fanza  # Fanza のみビルド

# === テスト ===

pnpm test:run     # ユニットテスト実行
pnpm test:e2e     # E2E テスト実行
pnpm test:e2e:web # Web の E2E テストのみ
pnpm test:all     # 全テスト実行

# === コード品質 ===

pnpm typecheck    # 型チェック
pnpm lint         # ESLint
pnpm format       # Prettier
pnpm format:check # フォーマットチェック (CI用)
```

### 5.3 Drizzle ORM コマンド

```bash
# マイグレーションファイル生成
pnpm db:generate

# スキーマを DB に直接適用 (開発用)
pnpm db:push

# マイグレーション実行
pnpm --filter=@adult-v/database db:migrate

# マイグレーション状態の確認
pnpm drizzle-kit check

# Drizzle Studio (DB ブラウザ)
pnpm drizzle-kit studio
```

### 5.4 クローラーコマンド (ローカル実行)

```bash
pnpm crawl:duga      # DUGA クロール
pnpm crawl:sokmil    # SOKMIL クロール
pnpm crawl:japanska  # Japanska クロール
pnpm crawl:mgs       # MGS クロール
pnpm crawl:fc2       # FC2 クロール
pnpm crawl:b10f      # b10f クロール
```

---

## 6. 連絡先・ダッシュボード

### 6.1 ダッシュボード URL 一覧

| サービス                     | URL                                                                      |
| ---------------------------- | ------------------------------------------------------------------------ |
| **Sentry (Web)**             | https://sentry.io/organizations/avviewer-lab/projects/web/               |
| **Sentry (Fanza)**           | https://sentry.io/organizations/avviewer-lab/projects/fanza/             |
| **Sentry Issues**            | https://sentry.io/organizations/avviewer-lab/issues/                     |
| **Firebase Console**         | https://console.firebase.google.com/project/adult-v/                     |
| **GCP Console**              | https://console.cloud.google.com/home/dashboard?project=adult-v          |
| **Cloud Run**                | https://console.cloud.google.com/run?project=adult-v                     |
| **Cloud SQL**                | https://console.cloud.google.com/sql/instances?project=adult-v           |
| **Cloud Scheduler**          | https://console.cloud.google.com/cloudscheduler?project=adult-v          |
| **Cloud Build**              | https://console.cloud.google.com/cloud-build/builds?project=adult-v      |
| **Secret Manager**           | https://console.cloud.google.com/security/secret-manager?project=adult-v |
| **Upstash Redis**            | https://console.upstash.com/                                             |
| **Google Analytics (Web)**   | GA ID: `G-V2X2861X15`                                                    |
| **Google Analytics (Fanza)** | GA ID: `G-PLRLLT8HYJ`                                                    |
| **GCP Billing**              | https://console.cloud.google.com/billing?project=adult-v                 |

### 6.2 重要な Secret 一覧

Secret Manager に格納されているシークレット:

| Secret 名                    | 用途                        | 使用アプリ |
| ---------------------------- | --------------------------- | ---------- |
| `database-url`               | PostgreSQL 接続 URL         | Web, Fanza |
| `firebase-api-key`           | Firebase API キー           | Web, Fanza |
| `sentry-dsn`                 | Sentry DSN (Web)            | Web        |
| `sentry-dsn-fanza`           | Sentry DSN (Fanza)          | Fanza      |
| `upstash-redis-url`          | Upstash Redis REST URL      | Web, Fanza |
| `upstash-redis-token`        | Upstash Redis REST トークン | Web, Fanza |
| `gemini-api-key`             | Gemini API キー (LLM)       | Web, Fanza |
| `deepl-api-key`              | DeepL API キー (翻訳)       | Web        |
| `duga-app-id`                | DUGA API アプリ ID          | Web, Fanza |
| `duga-agent-id`              | DUGA API エージェント ID    | Web, Fanza |
| `sokmil-api-key`             | SOKMIL API キー             | Web, Fanza |
| `google-service-account-key` | Google Indexing API         | Web        |

### 6.3 Cloud Scheduler ジョブ一覧 (クイックリファレンス)

詳細は [cloud-scheduler-setup.md](./cloud-scheduler-setup.md) を参照。

**クローラー (毎日)**:
`01:00~` DTI系 (caribbeancom, 1pondo, heyzo 等) → `03:00` MGS → `05:00` DUGA → `07:00` SOKMIL → `09:00` Japanska → `11:00` b10f → `13:00` FC2

**エンリッチメント (毎日)**:
`02,08,14,20:00` process-raw-data → `15:00` performer-pipeline → `16:00` content-enrichment → `17:00` normalize-performers → `18:00` enhance-content → `19:00` seo-enhance

**バックフィル**:
`20:00` backfill-videos → `21:00` backfill-images → 日曜 `03:00` backfill-performer-profiles → 日曜 `05:00` backfill-reviews → 日曜 `07:00` crawl-performer-lookup

**メンテナンス**:
`23:00` cleanup → 3時間ごと indexnow-notify → 月曜 `04:00` data-quality-report
