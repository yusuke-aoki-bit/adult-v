# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added

- commitlint によるコミットメッセージ検証
- Zod バリデーションスキーマ (packages/shared/src/lib/api-schemas.ts)
- 統合テスト追加
- パッケージ別 README
- 運用ランブック (docs/RUNBOOK.md)
- CONTRIBUTING.md

### Changed

- noUncheckedIndexedAccess を有効化
- CI パイプラインを強化 (format check, E2E, Sentry source maps, Dependabot)
- Prettier + husky + lint-staged 導入

## [0.9.0] - 2026-02-23

大規模な安定化リリース。500エラーの徹底排除、ISRの正常化、ニュース機能導入、出演者分類の自動化。

### Added

- ニュース機能導入（DB・API・Cron・UI） — ニュースページi18n対応・SEO改善
- 未整理出演者の3アプローチ並行分類（商品タグ導出・minnano-av強化・AI/Gemini）
- HEYDOUGA専用クローラー追加 & Cloud Scheduler設定更新
- FANZA fetchベースcronハンドラー追加 & FC2 auto-resume改善
- シリーズ・メーカーページにItemList構造化データ追加
- 価格比較API実装
- UI改善・メモリ最適化・cronタイムアウト対策
- セール期限切れクリーンアップ

### Changed

- 無限スクロール廃止、全ページでページネーションに統一
- API routes の graceful degradation（500→200+fallback）
- 全cronハンドラーにTIME_LIMIT(240s)タイムアウト保護を追加
- クローラーauto-resume導入でカバレッジ向上

### Fixed

- 5xxサーバーエラー修正（GSC インデックス登録エラー対応）
- headers()完全除去でISRページの500エラー解消
- getServerSiteMode/AspFilterでheaders()を回避しISR有効化
- ISR無効化問題を修正（8ページ）
- 商品検索API 500エラー修正（ANY演算子・search_vector参照）
- 商品・女優ページ500エラー修正（DYNAMIC_SERVER_USAGE解消）
- debutYear/minWorks/onSale フィルターが動作しない問題を修正
- おすすめ女優の画像が表示されない問題を修正
- 今週の注目セクションに女優が表示されない問題を修正
- MGS購入ボタンがHTMLウィジェットコードでエラーする問題を修正
- MGSアフィリエイトURL修正マイグレーション追加
- 無限スクロール時のフィルタ・ソートが無効になるバグ修正
- サイトマップ動的ルートのFirebase App Hosting 404対策
- 年齢認証モーダルのちらつき防止
- minnano-av.com画像の400エラー修正（next/image remotePatterns追加）
- 404ページi18n対応・翻訳カバレッジ100%達成
- 停止中クローラー復旧（DTI 3サイト追加・FC2セール・Japanska cookie対応）
- 価格フィルター時にキャッシュされた全件カウントが返されるバグを修正

### Security

- SQLインジェクション修正・キャッシュ最適化
- セキュリティ強化・Fanza復旧

## [0.8.0] - 2026-02-16

ASP Registry アーキテクチャ刷新、データ構造最適化、GCPコスト削減。

### Added

- Gemini Embedding移行・差別化機能・GCPコスト最適化
- 非正規化カラム自動同期をパイプラインに追加（Phase 6）
- UI最適化・SEO強化 — アフィリエイトCVR向上とサイトマップ拡充

### Changed

- ASP Registry一元化・バッチDB・クローラーN+1解消
- アプリ層をASP Registry対応に移行・クエリ共通化
- Cloud SchedulerをWeb App APIエンドポイント方式に移行
- データ構造最適化 — N+1解消・非正規化・インデックス・キャッシュ統一
- PV・CTR向上施策 — 内部回遊強化・メタデータ最適化・構造化データ拡充

## [0.7.0] - 2026-01-21

エンゲージメント向上、女優一覧の大幅強化、PV・アフィリエイト改善。

### Added

- 女優一覧にフィルター機能追加（デビュー年・作品数）
- /actressesページを追加
- PV・アフィリエイト収益改善機能追加
- CTA改善とキャッシュ強化でクリック率向上
- 重複ページ対策と商品詳細CTA強化
- エンゲージメント向上 - 無限スクロール導入とおすすめ機能改善
- コンテンツ品質向上 - 画像alt最適化・AIレビュー信頼度表示
- PV向上施策 - タグページ・内部リンク・OGP強化
- IndexNow API + robots.txt修正

### Changed

- schema.ts分割とデータ品質改善
- 女優一覧ページにキャッシュ追加、URL正規化をproxyに統合
- ホームページクエリにunstable_cacheを追加
- GCPコスト削減（月$195-370推定）

### Fixed

- セール女優画像とソート順の問題を修正
- FANZAサイトで非FANZA商品へのアクセス時に404を返す
- Sentry tunnel route 404

## [0.6.0] - 2026-01-08

差別化コンテンツ拡充、ステマ規制対応、自然言語検索、多機能化。

### Added

- 差別化コンテンツ4ページ追加とナビゲーション統一
- オリジナルコンテンツ6ページを追加
- 自然言語検索(pgvector)と多言語翻訳(DeepL)の実装
- ステマ規制対応のPR表記追加（商品詳細・女優・シリーズ・発掘ページ）
- DXLIVE統合
- DTI SPAサイト対応 & MGS Proxy対応
- Add update-performer-stats script to crawlers package
- Enhance admin dashboard with visual charts

### Changed

- 表示速度高速化 - PPR導入、遅延レンダリング実装

### Fixed

- 複数の改善 - FANZA 5xxエラー修正、DB graceful degradation、画像最適化
- Sentry issue修正 - テーブル不在時のgraceful degradation
- 複数APIハンドラーのgraceful degradation水平展開
- ASP規約遵守のためアフィリエイト関連コードを修正
- Google login popup appearing twice & user display name fallback
- TypeScript strict mode errors causing CI failures

## [0.5.0] - 2026-01-04

ユーザー参加型機能、ネットワーク可視化、一括比較モード追加。

### Added

- Add bulk comparison selection mode and comprehensive E2E tests
- Add public lists, scene info, and rookie ranking features
- Add user contribution platform features and UI/UX improvements
- Add SimilarProductMap and SimilarPerformerMap network visualization
- Add product identity matching system for cross-ASP product detection
- Add price alerts and purchase history import features
- Integrate UserContributionsSection into product detail pages
- Add HomeSectionManager to all major pages
- Add SEO optimization, performance improvements, and console error E2E tests
- Add CopyButton to product and actress list cards
- Add FanzaSiteBanner to actress list section on top page
- Add per-page selection to product list and optimize queries
- Add profile filters to homepage actress list
- Add filter preset save/load functionality
- Add alternativeSources to product list for cross-ASP price comparison
- Add image retry functionality on timeout

### Changed

- Consolidate theme-dependent components and API handlers
- Unify FANZA sitemap structure to match adult-v.com
- Update Tailwind CSS classes to canonical names
- Strengthen FANZA site traffic from apps/web

### Fixed

- SEO canonical/hreflang and robots.txt for duplicate content prevention
- Upgrade Next.js to 16.0.7 to fix CVE-2025-55182
- Job failures and debut stats calculation
- Sentry error fixes - useTranslations fallback and malformed image URLs
- Fix rookie performers API - use correct column name profileImageUrl

## [0.4.0] - 2025-12-29

翻訳基盤、Sentry統合、パイプライン統合、パフォーマンス最適化。

### Added

- Sentry integration and fix FC2 provider filter bug
- Add performer lookup pipeline for automated performer linking
- Add unified pipelines and consolidate cron jobs
- Add product_translations table and DEEPL_API_KEY to App Hosting
- Add AI review translation support
- Add DeepL translation support and Cloud Run job
- Add international search engine support for multilingual SEO
- Add 1pondo sample images backfill script for Cloud Run
- Add performer-pipeline Phase 3 script for fake performer merge
- Add sale features, statistics, and crawler improvements
- Split sitemap, improve product page UI, and add performer tools
- Add review translation support

### Changed

- Further consolidate pipelines and reduce cloud resources
- Increase default items per page to 96 and add scap URL conversion
- Convert N+1 performer queries to batch processing
- Replace any types with Drizzle ORM types for DI pattern
- Comprehensive code quality improvements
- catch句のany型をunknown型に修正

### Fixed

- Properly format array for PostgreSQL ANY() in batchFetchProductRelatedData
- Remove duplicate product URLs from sitemap to fix GSC issues
- FC2/DUGA表示問題を修正 - originalProductIdで重複判定
- Replace sql.raw() with parameterized queries for SQL injection prevention
- Cloud Run Jobs DB connection issues and add Sentry test endpoints
- Add TCP keepalive and extend idle timeout for crawler DB connections
- Add rate limiting and retry logic for DeepL API

### Performance

- Comprehensive performance optimizations
- Optimize products page TTFB and image loading

## [0.3.0] - 2025-12-22

モノレポ移行完了、共有パッケージ統合、ASP表示統一、クローラー大幅強化。

### Added

- SEO improvements and internal linking enhancements
- Add shared ASP filter and cache utilities for code deduplication
- Add shared utilities for error handling, auth, and core queries
- Add type definitions, structured logging, and architecture docs
- Add retry logic to crawler API clients
- Add historical crawl script for all ASPs
- Add performer extraction for HEYZO/DTI and improve filters
- Add genre tags to filter UI and backfill scripts
- Add performer lookup table and bulk crawl API
- Google API enhancement endpoints and service account integration
- SEO and accessibility improvements
- Comprehensive UI/UX accessibility improvements
- Add legal compliance page with affiliate ToS compliance report
- Add vitest/E2E test infrastructure
- Add PageSpeed Insights monitoring with Cloud Scheduler
- Add Firebase integration with anonymous auth support
- Add Firestore security rules for user data

### Changed

- Refactor to pnpm monorepo with Turborepo
- Consolidate shared code between apps/web and apps/fanza
- Extract ASP normalization utilities (Phase 1-2) — ASP Registry一元化
- Consolidate crawlers into grouped Cloud Run Jobs
- Consolidate remaining lib files to shared package
- Refactor CSS/Tailwind to shared package and fix ASP badge filters
- Unify ASP display order and color scheme across Header and Filter
- Display all ASP sites individually instead of grouping DTI
- Move Firebase API key to Secret Manager
- Optimize page performance: fix perPage to 24, add ItemListSchema to categories
- Optimize product detail page with parallel queries and shared DB helpers
- Optimize header performance: replace dynamic ASP stats with static list

### Fixed

- Fix DMM image loading: convert awsimgsrc.dmm.co.jp to pics.dmm.co.jp
- Fix Service Worker CSP violations blocking external images
- Fix HEYDOUGA performer extraction from img alt attributes
- Fix TMP site thumbnail URLs for X1X, ENKOU55, UREKKO, TVDEAV
- Fix SEO: Add /ja/ locale prefix to sitemap and indexing URLs, add noindex for non-default sort
- Fix useSearchParams Suspense boundary error in Header/Pagination
- Fix pagination filter auto-selection bug
- Fix age verification bot detection and XSS false positive
- Fix minnano-av crawler to save performer profile images
- Fix MGS crawler sample video URL extraction
- Fix FANZA crawler productVideos save bug

### Security

- CRITICAL SECURITY: Fix CVE-2025-55182 RCE vulnerability
- Remove API keys from .env.example and fix gitignore
- Remove docs folder containing exposed API key
- Add security hardening: bot protection, rate limiting, and security headers
- Implement Google Consent Mode v2 for GA4

### Performance

- Improve Core Web Vitals (CLS/LCP) for PageSpeed optimization
- Improve LCP: Update preconnect hints for image domains
- Improve PageSpeed: cache headers and contrast ratio
- Optimize font loading for better LCP
- Optimize metadata generation for PageSpeed Insights

## [0.2.0] - 2025-12-11

Next.js 16移行、Firebase App Hosting対応、多言語SEO強化。

### Added

- Add next-intl middleware for locale redirect
- Add apphosting.yaml to apps/web and apps/fanza for monorepo support
- Improve international SEO and PageSpeed Insights support
- Add E2E tests with Playwright
- E-E-A-T SEO強化実装
- Add Firebase AI integration and enhance homepage features
- Add Cloud Scheduler cron API endpoints
- Add cron APIs for backfill and cleanup

### Changed

- Update Next.js to 16.x (via 15.3.3 -> 16.0.7)
- Migrate to Next.js 16 proxy pattern and add new features
- Add .npmrc with hoisting settings for Firebase App Hosting

### Fixed

- Fix Firebase App Hosting monorepo build issues
- Fix outputFileTracingRoot to use monorepo root
- Enhance bot detection for PageSpeed Insights
- sitemap動的生成とDATABASE_URLフォールバック対応
- Fix Next.js dynamic route parameter conflict
- Fix sitemap.ts schema errors

### Security

- Update Next.js to 15.3.3 to fix CVE-2025-55182
- Update Next.js to 16.0.7 to fix CVE-2025-66478

## [0.1.0] - 2025-11-22

初回リリース。PostgreSQL移行、SEO最適化、基本的なクローラー基盤の構築。

### Added

- PostgreSQL への DB 移行（SQLite から）
- 包括的なSEO最適化（メタデータ、構造化データ、サイトマップ）
- 年齢認証ページ
- プライバシーポリシー・利用規約ページ
- ダークテーマの統一適用
- MGS affiliate crawler with performer extraction
- Firebase App Hosting 設定
- 商品詳細ページ・女優ページの実装
- 検索機能（FilterSortBar）
- 画像プレースホルダー・クローラーインフラ
- Add JSON API support for 一本道 actress data

### Changed

- Migrate all pages from mockData to database queries
- APEXからDUGAへの移行、UI改善
- Unify dark theme across all pages and improve image placeholders
- Improve SEO: Allow search engine bots and add comprehensive metadata

### Fixed

- Fix Cloud SQL connection from Cloud Run
- Fix production build by moving Tailwind CSS to dependencies
- Fix build errors for production deployment
- Fix age verification page build errors
- Fix TypeScript errors (Campaign type, optional actressId, params type)

## [0.0.1] - 2025-11-15

プロジェクト初期化。

### Added

- Initial commit from Create Next App
- Next.js プロジェクトの基本構成
- Header / Footer コンポーネント
- ホームページ（注目商品・女優・レビュー・キャンペーン表示）
- DMM 関連プラットフォームの画像リモートパターン設定
