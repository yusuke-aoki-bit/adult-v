# adult-v プロジェクト ステータス

**最終更新**: 2025-12-17

---

## 📊 データベース統計

| 指標 | 件数 |
|------|------|
| 総商品数 | 218,959 |
| 総演者数 | 26,357 |
| 総画像数 | 3,386,369 |
| 総動画数 | 179,802 |

### ASP別 商品数

| ASP名 | 商品数 |
|-------|--------|
| SOKMIL | 102,337 |
| DUGA | 56,953 |
| b10f | 21,878 |
| FANZA | 15,469 |
| MGS | 11,729 |
| カリビアンコムプレミアム | 4,723 |
| HEYZO | 3,311 |
| FC2 | 1,621 |
| 一本道 | 840 |
| Japanska | 98 |

---

## ✅ コード品質改善（全完了）

### スコアカード

| 観点 | スコア |
|------|--------|
| セキュリティ | 9/10 ✅ |
| パフォーマンス | 8/10 ✅ |
| 型安全性 | 8/10 ✅ |
| コード重複 | 8/10 ✅ |
| エラーハンドリング | 8/10 ✅ |
| 保守性 | 8/10 ✅ |

### 完了した改善

| フェーズ | 内容 | 実装場所 |
|---------|------|----------|
| P1 セキュリティ | Cron認証OIDC化、sql.raw排除、入力バリデーション | packages/shared/src/lib/ |
| P2 コード重複 | ASPマッピング統合、CrawlerAIHelper、フィルター定数 | packages/shared/, packages/crawlers/ |
| P3 パフォーマンス | useMemo適用、Promise.all並列化 | components/, api-handlers/ |
| P4 堅牢性 | withRetry、RateLimiter、指数バックオフ | packages/crawlers/src/lib/crawler/ |
| P5 型安全性 | ProviderId統一（17種）、as any排除 | packages/shared/src/types/ |

---

## 🔧 クローラー状況

### 正常稼働中

| クローラー | 状態 | 備考 |
|-----------|------|------|
| SOKMIL | ✅ | API v2、102,337件 |
| DUGA | ✅ | API v1、56,953件 |
| b10f | ✅ | 21,878件 |
| FANZA | ✅ | 動画保存バグ修正済み |
| MGS | ✅ | 動画URL抽出修正済み |
| DTI群 | ✅ | カリビアン、HEYZO、一本道等 |
| FC2 | ✅ | 1,621件 |

### 実装済み機能

- **CrawlerAIHelper**: 説明文生成、タグ抽出、翻訳の統一インターフェース
- **RateLimiter**: サイト別設定、指数バックオフ、同時実行制限
- **withRetry/fetchWithRetry**: リトライ可能ステータスコード判定、ジッター

---

## 🌏 インフラ構成

| サービス | リージョン |
|----------|-----------|
| Cloud Run Jobs | asia-northeast1 (東京) |
| Cloud SQL | asia-northeast1 (東京) |
| Cloud Storage | asia-northeast1 (東京) |
| Firebase App Hosting | asia-northeast1 (東京) |

---

## 📋 運用タスク

### 定期実行

- クローラーはCloud Schedulerで自動実行
- admin/statsで収集状況を監視

### 必要に応じて実行

- `--force`オプションで既存データの再クロール
- minnano-av-performersジョブで演者画像取得

---

## 🔗 主要ファイル

| 用途 | パス |
|------|------|
| APIハンドラー | packages/shared/src/api-handlers/ |
| クローラー共通 | packages/crawlers/src/lib/crawler/ |
| 型定義 | packages/shared/src/types/product.ts |
| プロバイダー設定 | packages/shared/src/providers.ts |
