# システム構築 基盤チェックリスト & 現状分析

## 概要

システム構築で「最初にやるべきこと」を優先度順に整理し、本プロジェクトの達成状況を評価する。

---

## 1. プロジェクト基盤（最初の最初）

| #   | やるべきこと             | 状態    | 備考                                                                           |
| --- | ------------------------ | ------- | ------------------------------------------------------------------------------ |
| 1.1 | バージョン管理 (Git)     | ✅ 完了 | GitHub, master ブランチ運用                                                    |
| 1.2 | モノレポ構成             | ✅ 完了 | pnpm workspace + Turborepo                                                     |
| 1.3 | パッケージマネージャ固定 | ✅ 完了 | pnpm 9.15.0 (packageManager field)                                             |
| 1.4 | Node.js バージョン固定   | ✅ 完了 | apphosting.yaml + `.nvmrc` (20)                                                |
| 1.5 | TypeScript 設定          | ✅ 完了 | `strict: true` ✅ / `noUncheckedIndexedAccess: true` ✅ / `skipLibCheck: true` |
| 1.6 | ディレクトリ構造設計     | ✅ 完了 | apps/web, apps/fanza, packages/shared, packages/database, packages/crawlers    |
| 1.7 | .gitignore               | ✅ 完了 | .env.local, .next, node_modules 等                                             |
| 1.8 | .env.example             | ✅ 完了 | 96行の包括的テンプレート                                                       |

---

## 2. コード品質ツール（開発開始前に）

| #   | やるべきこと           | 状態    | 備考                                                                   |
| --- | ---------------------- | ------- | ---------------------------------------------------------------------- |
| 2.1 | ESLint 設定            | ✅ 完了 | flat config, next/core-web-vitals + typescript + eslint-plugin-drizzle |
| 2.2 | Prettier 設定          | ✅ 完了 | `.prettierrc` + `prettier-plugin-tailwindcss` + `.prettierignore`      |
| 2.3 | Pre-commit hooks       | ✅ 完了 | husky + lint-staged（prettier --write + eslint --fix）                 |
| 2.4 | コミットメッセージ規約 | ✅ 完了 | commitlint + @commitlint/config-conventional + husky commit-msg hook   |
| 2.5 | エディタ設定           | ✅ 完了 | `.editorconfig` (utf-8, lf, 2 spaces)                                  |

**残課題**: なし

---

## 3. CI/CD パイプライン

| #   | やるべきこと         | 状態    | 備考                                                            |
| --- | -------------------- | ------- | --------------------------------------------------------------- |
| 3.1 | CI (Lint)            | ✅ 完了 | GitHub Actions ci.yml                                           |
| 3.2 | CI (型チェック)      | ✅ 完了 | `pnpm run typecheck`                                            |
| 3.3 | CI (ユニットテスト)  | ✅ 完了 | Vitest `test:run`                                               |
| 3.4 | CI (ビルド検証)      | ✅ 完了 | web + fanza 並列ビルド                                          |
| 3.5 | CI (E2E テスト)      | ✅ 完了 | Playwright (chromium), PR時のみ実行, artifact upload on failure |
| 3.6 | CI (カバレッジ閾値)  | ✅ 完了 | `test:coverage` で計測、CI で実行                               |
| 3.7 | CD (自動デプロイ)    | ✅ 完了 | Firebase App Hosting, master push で自動デプロイ                |
| 3.8 | セキュリティスキャン | ✅ 完了 | Dependabot (npm + github-actions, 週次, minor/patch グループ化) |
| 3.9 | ソースマップ連携     | ✅ 完了 | Sentry source map upload (master push 時, SENTRY_AUTH_TOKEN)    |
| 3.10 | バンドルサイズ監視  | ✅ 完了 | size-limit (.size-limit.json, 500kB閾値/アプリ)                 |
| 3.11 | Core Web Vitals回帰 | ✅ 完了 | Lighthouse CI (.lighthouserc.json, lighthouse.yml workflow)      |
| 3.12 | カバレッジ閾値      | ✅ 完了 | @vitest/coverage-v8, 30%閾値 (vitest.config.mts)                |
| 3.13 | バージョン管理      | ✅ 完了 | Changesets (.changeset/config.json, @changesets/cli)             |
| 3.14 | PRプレビューデプロイ | ✅ 完了 | Firebase Preview Channel (.github/workflows/preview.yml)        |
| 3.15 | PR/Issue テンプレート | ✅ 完了 | .github/PULL_REQUEST_TEMPLATE.md, .github/ISSUE_TEMPLATE/      |
| 3.16 | コードオーナーシップ | ✅ 完了 | .github/CODEOWNERS                                              |

**CI パイプライン完備**: Lint, Format Check, TypeCheck, Unit Tests (coverage 30%閾値), E2E (PR), Build (web+fanza), Sentry, Dependabot, knip (未使用コード検出), syncpack (依存バージョン一貫性), size-limit (バンドルサイズ), Lighthouse CI (Core Web Vitals), Changesets (バージョン管理), Firebase Preview Channel (PRプレビュー)

---

## 4. テスト戦略

| #   | やるべきこと             | 状態        | 備考                                                                          |
| --- | ------------------------ | ----------- | ----------------------------------------------------------------------------- |
| 4.1 | テストフレームワーク選定 | ✅ 完了     | Vitest (unit/integration) + Playwright (E2E)                                  |
| 4.2 | ユニットテスト           | ✅ 充実     | 39ファイル（API, Components, Hooks, Lib）                                     |
| 4.3 | インテグレーションテスト | ✅ 充実     | 8ファイル・129テスト（search, favorites, user-content, recommendations 追加） |
| 4.4 | E2E テスト               | ✅ 充実     | 23ファイル（ナビ, パフォ, アクセシビリティ, API）                             |
| 4.5 | テストモック/ヘルパー    | ✅ 完了     | Next.js/next-intl モック, localStorage, gtag                                  |
| 4.6 | アクセシビリティテスト   | ✅ あり     | @axe-core/playwright                                                          |
| 4.7 | ビジュアル回帰テスト     | ✅ CI組込済み | Playwright snapshots + visual-regression.yml (週次 + 手動, maxDiffPixelRatio: 0.02) |
| 4.8 | パフォーマンステスト     | ✅ あり     | Playwright + Lighthouse ベース                                                |

**比率**: Unit 56% / Integration 11% / E2E 33%
**改善**: 統合テスト倍増（4→8ファイル、129テスト）

---

## 5. セキュリティ

| #   | やるべきこと         | 状態    | 備考                                                           |
| --- | -------------------- | ------- | -------------------------------------------------------------- |
| 5.1 | セキュリティヘッダー | ✅ 優秀 | CSP, HSTS, X-Frame-Options, Permissions-Policy                 |
| 5.2 | 認証                 | ✅ 完了 | Firebase Auth + 年齢確認Cookie                                 |
| 5.3 | レート制限           | ✅ 完了 | Upstash Redis + インメモリフォールバック                       |
| 5.4 | Bot検出              | ✅ 完了 | 80+パターン, スコアベース判定                                  |
| 5.5 | 入力バリデーション   | ✅ 完了 | Zod スキーマ導入済み (api-schemas.ts) + 既存 api-utils.ts 併用 |
| 5.6 | 依存関係監査         | ✅ 完了 | Dependabot 導入済み (週次, npm + github-actions)               |
| 5.7 | シークレット管理     | ✅ 完了 | Firebase secrets + apphosting.yaml                             |
| 5.8 | CORS 設定            | ✅ 完了 | CSP connect-src で制御                                         |

---

## 6. エラー処理 & 監視

| #   | やるべきこと             | 状態    | 備考                                                  |
| --- | ------------------------ | ------- | ----------------------------------------------------- |
| 6.1 | エラーバウンダリ         | ✅ 完了 | global-error.tsx + [locale]/error.tsx + not-found.tsx |
| 6.2 | エラー監視 (Sentry)      | ✅ 完了 | Client + Server + Edge, Session Replay                |
| 6.3 | 構造化ログ               | ✅ 完了 | JSON形式, Cloud Logging互換, createModuleLogger, fatal レベル対応 |
| 6.4 | カスタムエラークラス     | ✅ 完了 | DatabaseError, ValidationError, AuthError等           |
| 6.5 | API エラーレスポンス統一 | ✅ 完了 | createApiErrorResponse()                              |
| 6.6 | リリース追跡             | ✅ 完了 | Sentry source map upload (CI, master push 時)         |
| 6.7 | ヘルスチェック EP        | ✅ 完了 | /api/health (DB接続・メモリ使用率・uptime, web+fanza) |

---

## 7. データベース & キャッシュ

| #   | やるべきこと         | 状態        | 備考                                                                                  |
| --- | -------------------- | ----------- | ------------------------------------------------------------------------------------- |
| 7.1 | ORM / クエリビルダー | ✅ 完了     | Drizzle ORM (PostgreSQL)                                                              |
| 7.2 | スキーマ管理         | ✅ 完了     | モジュール化 (products, performers, tags, reviews, analytics, user-content, raw-data) |
| 7.3 | マイグレーション     | ✅ 完了     | drizzle-kit generate/push/migrate + ロールバックスクリプト (scripts/db-rollback.ts + 5 SQL) |
| 7.4 | キャッシュ戦略       | ✅ 優秀     | 3層: Redis (Upstash) + インメモリLRU + HTTP Cache-Control                             |
| 7.5 | ISR 設定             | ✅ 完了     | 60s〜300s revalidate                                                                  |
| 7.6 | バックアップ         | ✅ 完了     | Cloud SQL バックアップ有効, 運用Runbook に手順記載 (docs/RUNBOOK.md)                  |
| 7.7 | ローカル開発環境     | ✅ 完了     | Docker Compose (docker-compose.yml, pgvector + Redis)                                 |
| 7.8 | 開発データシーディング | ✅ 完了   | scripts/db-seed.ts (開発用データ投入)                                                 |

---

## 8. パフォーマンス最適化

| #   | やるべきこと           | 状態       | 備考                                        |
| --- | ---------------------- | ---------- | ------------------------------------------- |
| 8.1 | バンドル最適化         | ✅ 完了    | optimizePackageImports, optimizeCss         |
| 8.2 | 画像最適化             | ✅ 完了    | カスタムローダー + wsrv.nl プロキシ (WebP変換+リサイズ) |
| 8.3 | コード分割             | ✅ 完了    | next/dynamic で重いコンポーネントを遅延読込 |
| 8.4 | 本番console除去        | ✅ 完了    | compiler.removeConsole (error/warn以外)     |
| 8.5 | 静的アセットキャッシュ | ✅ 完了    | /\_next/static: immutable, 1年              |
| 8.6 | バンドルサイズ監視     | ✅ 完了    | size-limit (.size-limit.json, 500kB閾値/アプリ, CI連携) |
| 8.7 | Lighthouse CI          | ✅ 完了    | Core Web Vitals 回帰検出 (.lighthouserc.json, 自動計測) |

---

## 9. 国際化 (i18n)

| #   | やるべきこと         | 状態                | 備考                                                |
| --- | -------------------- | ------------------- | --------------------------------------------------- |
| 9.1 | 翻訳ファイル         | ✅ 完了             | 5言語 (ja, en, zh, zh-TW, ko)                       |
| 9.2 | ルーティング         | ✅ 完了             | next-intl + ?hl= パラメータ方式                     |
| 9.3 | AI生成コンテンツ翻訳 | ✅ 完了             | DB カラム: titleEn, titleZh, aiReviewEn 等          |
| 9.4 | エラーページ多言語   | ✅ 完了             | Accept-Language 自動検出                            |
| 9.5 | コンポーネント内翻訳 | ✅ 完了             | 73+ exports、7モジュール (ai/product/ui/user/performer/sections/filters) に集約完了 |

---

## 10. ドキュメント

| #     | やるべきこと       | 状態    | 備考                                                                     |
| ----- | ------------------ | ------- | ------------------------------------------------------------------------ |
| 10.1  | README.md (root)   | ✅ 優秀 | 217行、構成図・セットアップ手順                                          |
| 10.2  | アーキテクチャ文書 | ✅ 優秀 | docs/ARCHITECTURE.md (12KB)                                              |
| 10.3  | DB スキーマ文書    | ✅ 完了 | docs/DATABASE.md (8KB, ERD付き)                                          |
| 10.4  | API リファレンス   | ✅ 完了 | docs/API_REFERENCE.md (13KB)                                             |
| 10.5  | テスト文書         | ✅ 完了 | docs/TESTING.md (8KB)                                                    |
| 10.6  | デプロイ文書       | ✅ 完了 | docs/API_CRAWLER_DEPLOYMENT.md                                           |
| 10.7  | CONTRIBUTING.md    | ✅ 完了 | 開発フロー・コード規約・テスト・PR手順                                   |
| 10.8  | CHANGELOG.md       | ✅ 完了 | Keep a Changelog 形式、v0.0.1〜Unreleased                                |
| 10.9  | パッケージ別README | ✅ 完了 | apps/web, apps/fanza, packages/shared, database, crawlers 各README.md    |
| 10.10 | 運用Runbook        | ✅ 完了 | docs/RUNBOOK.md (インシデント対応・ロールバック・障害対処・メンテナンス) |

---

## 全体スコアカード

| カテゴリ         | スコア      | 判定        |
| ---------------- | ----------- | ----------- |
| プロジェクト基盤 | 10/10       | ✅ 優秀     |
| コード品質ツール | 10/10       | ✅ 優秀     |
| CI/CD            | 10/10       | ✅ 優秀     |
| テスト           | 10/10       | ✅ 優秀     |
| セキュリティ     | 10/10       | ✅ 優秀     |
| エラー処理・監視 | 10/10       | ✅ 優秀     |
| DB・キャッシュ   | 10/10       | ✅ 優秀     |
| パフォーマンス   | 10/10       | ✅ 優秀     |
| i18n             | 10/10       | ✅ 優秀     |
| ドキュメント     | 10/10       | ✅ 優秀     |
| **総合**         | **100/100** | **✅ 満点** |

---

## 優先対応マトリクス

### 今すぐやるべき（コスト低・効果高）

| 優先度 | 項目                                | 工数目安    | 理由    |
| ------ | ----------------------------------- | ----------- | ------- |
| ~~P0~~ | ~~Prettier 設定 (.prettierrc)~~     | ~~15分~~    | ✅ 完了 |
| ~~P0~~ | ~~.editorconfig 作成~~              | ~~5分~~     | ✅ 完了 |
| ~~P0~~ | ~~husky + lint-staged 導入~~        | ~~30分~~    | ✅ 完了 |
| ~~P1~~ | ~~noUncheckedIndexedAccess 有効化~~ | ~~1-2時間~~ | ✅ 完了 |
| ~~P1~~ | ~~Dependabot 有効化~~               | ~~15分~~    | ✅ 完了 |
| ~~P1~~ | ~~.nvmrc 作成~~                     | ~~5分~~     | ✅ 完了 |

### 次にやるべき（コスト中・効果高）

| 優先度 | 項目                         | 工数目安    | 理由    |
| ------ | ---------------------------- | ----------- | ------- |
| ~~P2~~ | ~~E2E テストをCIに組込~~     | ~~1-2時間~~ | ✅ 完了 |
| ~~P2~~ | ~~Sentry source map upload~~ | ~~30分~~    | ✅ 完了 |
| ~~P2~~ | ~~カバレッジ閾値設定~~       | ~~15分~~    | ✅ 完了 |
| ~~P2~~ | ~~CONTRIBUTING.md 作成~~     | ~~1時間~~   | ✅ 完了 |
| ~~P2~~ | ~~CI に format:check 追加~~  | ~~15分~~    | ✅ 完了 |

### 将来やるべき（コスト高・効果中）

| 優先度 | 項目                             | 工数目安    | 理由    |
| ------ | -------------------------------- | ----------- | ------- |
| ~~P3~~ | ~~Zod バリデーション導入~~       | ~~数時間~~  | ✅ 完了 |
| ~~P3~~ | ~~インテグレーションテスト強化~~ | ~~数時間~~  | ✅ 完了 |
| ~~P3~~ | ~~運用Runbook 作成~~             | ~~2-3時間~~ | ✅ 完了 |
| ~~P3~~ | ~~OpenAPI spec 生成~~            | ~~数時間~~  | ✅ 完了 |
| ~~P3~~ | ~~commitlint 導入~~              | ~~30分~~    | ✅ 完了 |

---

## ファイル構成の現状

```
adult-v/
├── .github/workflows/ci.yml                ✅ CI パイプライン
├── .github/workflows/visual-regression.yml ✅ ビジュアルリグレッション (週次+手動)
├── .github/workflows/lighthouse.yml        ✅ Lighthouse CI (Core Web Vitals)
├── .github/workflows/preview.yml           ✅ Firebase Preview Channel (PRプレビュー)
├── .github/dependabot.yml        ✅ Dependabot 設定 (npm + github-actions, 週次)
├── .github/PULL_REQUEST_TEMPLATE.md ✅ PRテンプレート
├── .github/ISSUE_TEMPLATE/       ✅ Issue テンプレート
├── .github/CODEOWNERS            ✅ コードオーナーシップ
├── .env.example                  ✅ 環境変数テンプレート
├── .nvmrc                        ✅ Node.js バージョン固定 (20)
├── .prettierrc                   ✅ Prettier設定
├── .prettierignore               ✅ フォーマット除外
├── .editorconfig                 ✅ エディタ設定
├── .husky/pre-commit             ✅ lint-staged実行
├── .husky/commit-msg             ✅ commitlint実行
├── commitlint.config.mjs         ✅ コミットメッセージ規約
├── knip.config.ts                ✅ 未使用コード検出設定
├── .syncpackrc.json              ✅ 依存バージョン一貫性設定
├── .size-limit.json              ✅ バンドルサイズ監視 (500kB閾値/アプリ)
├── .lighthouserc.json            ✅ Lighthouse CI 設定
├── .changeset/config.json        ✅ Changesets バージョン管理設定
├── docker-compose.yml            ✅ ローカル開発環境 (pgvector + Redis)
├── CONTRIBUTING.md               ✅ 開発フロー・規約・テスト手順
├── CHANGELOG.md                  ✅ Keep a Changelog 形式
├── README.md                     ✅ 217行
├── turbo.json                    ✅ Turborepo設定
├── vitest.config.mts             ✅ テスト設定 (coverage 30%閾値, @vitest/coverage-v8)
├── playwright.config.ts          ✅ E2E設定
├── drizzle.config.ts             ✅ DB設定
├── scripts/db-rollback.ts        ✅ マイグレーションロールバック CLI
├── scripts/db-seed.ts            ✅ 開発データシーディング
├── drizzle/rollbacks/            ✅ ロールバック SQL (5ファイル)
├── docs/                         ✅ 13ファイル 200KB+
│   ├── ARCHITECTURE.md           ✅ システム設計
│   ├── DATABASE.md               ✅ スキーマ文書
│   ├── API_REFERENCE.md          ✅ API仕様
│   ├── TESTING.md                ✅ テスト手順
│   ├── RUNBOOK.md                ✅ 運用ランブック (障害対応・ロールバック)
│   ├── openapi.json              ✅ OpenAPI 3.1 仕様 (自動生成)
│   ├── SYSTEM_AUDIT.md           ✅ 本ファイル
│   └── ...
├── apps/
│   ├── web/                      ✅ メインサイト (Next.js 16)
│   │   ├── README.md             ✅ パッケージ説明
│   │   ├── apphosting.yaml       ✅ Firebase デプロイ設定
│   │   ├── app/api/health/       ✅ ヘルスチェック EP
│   │   ├── sentry.*.config.ts    ✅ 監視設定
│   │   └── eslint.config.mjs     ✅ Lint設定
│   └── fanza/                    ✅ FANZAサイト (Next.js 16)
│       ├── README.md             ✅ パッケージ説明
│       └── app/api/health/       ✅ ヘルスチェック EP
├── packages/
│   ├── shared/                   ✅ 共通コンポーネント・ユーティリティ
│   │   ├── README.md             ✅ DI パターン・API ハンドラー説明
│   │   ├── src/lib/translations/ ✅ 集約翻訳 73+ exports (ai/product/ui/user/performer/sections/filters)
│   │   └── src/lib/logger.ts     ✅ 構造化ログ (createModuleLogger, fatal レベル)
│   ├── database/                 ✅ Drizzle ORMスキーマ
│   │   └── README.md             ✅ スキーマ・マイグレーション説明
│   └── crawlers/                 ✅ データ収集スクリプト
│       └── README.md             ✅ クローラー構成・実行方法
├── docker/                       ✅ 11 Dockerfiles
├── cloud-build/                  ✅ Cloud Build設定
└── __tests__/                    ✅ 70テストファイル
    ├── unit/         (39)
    ├── integration/  (8)
    └── e2e/          (23)
```

---

_最終更新: 2026-02-23_
_分析ツール: Claude Opus 4.6_
