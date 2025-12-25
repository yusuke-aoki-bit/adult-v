# アーキテクチャ設計書

## 概要

adult-vは、複数のアダルトビデオASP（アフィリエイトサービスプロバイダー）から商品データを収集・統合し、ユーザーに最適な価格比較と商品発見を提供するプラットフォームです。

## システム構成

```
┌─────────────────────────────────────────────────────────────────┐
│                         ユーザー                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Firebase App Hosting                          │
│  ┌─────────────────┐  ┌─────────────────┐                       │
│  │   apps/web      │  │   apps/fanza    │                       │
│  │  (adult-v.com)  │  │ (fanza専用サイト) │                       │
│  └────────┬────────┘  └────────┬────────┘                       │
│           │                    │                                 │
│           └──────────┬─────────┘                                 │
│                      ▼                                           │
│         ┌─────────────────────────┐                             │
│         │   packages/shared       │                             │
│         │  (共有コンポーネント/ロジック) │                             │
│         └─────────────────────────┘                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Cloud SQL (PostgreSQL)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  products   │  │  performers │  │    tags     │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │product_sources│ │product_sales│ │product_images│             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │
┌─────────────────────────────────────────────────────────────────┐
│                    Cloud Run Jobs                                │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                packages/crawlers                             ││
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       ││
│  │  │  FANZA   │ │   DUGA   │ │  SOKMIL  │ │   MGS    │       ││
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘       ││
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       ││
│  │  │   DTI    │ │   FC2    │ │ TokyoHot │ │   B10F   │       ││
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘       ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## モノレポ構成

```
adult-v/
├── apps/
│   ├── web/                    # メインサイト (adult-v.com)
│   │   ├── app/                # Next.js App Router
│   │   ├── components/         # アプリ固有コンポーネント
│   │   └── lib/                # アプリ固有ロジック
│   │       └── db/             # DB接続・クエリ
│   │
│   └── fanza/                  # FANZA専用サイト
│       ├── app/                # Next.js App Router
│       ├── components/         # アプリ固有コンポーネント
│       └── lib/                # アプリ固有ロジック
│
├── packages/
│   ├── shared/                 # 共有パッケージ
│   │   ├── src/
│   │   │   ├── components/     # 共有UIコンポーネント
│   │   │   ├── db-queries/     # 共有DBクエリ
│   │   │   ├── lib/            # 共有ユーティリティ
│   │   │   └── types/          # 共有型定義
│   │   └── package.json
│   │
│   ├── crawlers/               # クローラーパッケージ
│   │   ├── src/
│   │   │   ├── products/       # 商品クローラー
│   │   │   ├── performers/     # 出演者クローラー
│   │   │   ├── enrichment/     # データ拡充処理
│   │   │   └── lib/            # クローラーユーティリティ
│   │   └── package.json
│   │
│   └── database/               # DBスキーマ定義
│       └── src/
│           └── schema.ts       # Drizzle ORMスキーマ
│
├── scripts/                    # 運用スクリプト
└── docs/                       # ドキュメント
```

## データフロー

### 1. 商品収集フロー

```
クローラー実行 (Cloud Run Jobs)
    │
    ▼
┌─────────────────────┐
│ 生データ取得         │
│ (HTML/API/CSV)      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ ハッシュによる重複検出 │
│ (GCS + raw_*_data)  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ データ正規化         │
│ (品番、タイトル、出演者) │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 名寄せ処理           │
│ (同一商品の統合)      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ DB保存              │
│ (products, sources) │
└─────────────────────┘
```

### 2. 名寄せロジック

```typescript
// 品番ベース名寄せ
normalizedProductId = normalize(originalProductId)
// 例: "SSIS-865" → "ssis865"

// タイトルベース名寄せ (品番が異なる場合)
normalizedTitle = REGEXP_REPLACE(title, '[[:space:]　]+', '', 'g')
// 同一タイトルの商品を統合
```

## サイトモード

### all モード (apps/web)

- 全ASPの商品を表示
- FANZA専用商品は除外（他ASPがある場合は許可）

### fanza-only モード (apps/fanza)

- FANZAの商品のみを表示
- アフィリエイトリンクはFANZA専用

## 技術スタック

### フロントエンド

- **フレームワーク**: Next.js 15 (App Router)
- **スタイリング**: Tailwind CSS
- **UI**: shadcn/ui
- **状態管理**: React hooks
- **国際化**: next-intl

### バックエンド

- **ランタイム**: Node.js 20
- **ORM**: Drizzle ORM
- **データベース**: PostgreSQL (Cloud SQL)
- **キャッシュ**: unstable_cache, メモリキャッシュ

### インフラ

- **ホスティング**: Firebase App Hosting
- **データベース**: Google Cloud SQL
- **ストレージ**: Google Cloud Storage
- **ジョブ実行**: Cloud Run Jobs
- **スケジューラ**: Cloud Scheduler
- **シークレット**: Secret Manager

## 共有パッケージ

### @adult-v/shared

```typescript
// コンポーネント
import { ProductCard, Header, Footer } from '@adult-v/shared/components';

// DBクエリ
import { createProductQueries, createActressQueries } from '@adult-v/shared/db-queries';

// ユーティリティ
import { logger, withRetry, validateCronRequest } from '@adult-v/shared/lib';

// 型定義
import type { ProductType, ActressType } from '@adult-v/shared/types';
```

### 依存性注入パターン

```typescript
// クエリファクトリーの使用例
const queries = createProductQueries({
  getDb: () => db,
  products,
  performers,
  // ... テーブル参照を注入
});

// 使用
const product = await queries.getProductById(id);
```

## セキュリティ

### API認証

```typescript
// Cron API
verifyCronRequest(request) // OIDCトークン or X-Cron-Secret

// Admin API
verifyAdminRequest(request) // Bearer token or X-Admin-Secret
```

### 環境変数

- 機密情報は Secret Manager で管理
- `.env.example` にはプレースホルダーのみ

## 今後の課題

1. **テストカバレッジ**: 現状10-20%、目標60%以上
2. **型安全性**: any型の削減
3. **監視・アラート**: Prometheusメトリクス導入
4. **パフォーマンス**: N+1クエリの最適化
