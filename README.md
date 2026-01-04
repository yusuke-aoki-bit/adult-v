# Adult Viewer Lab

ヘビー視聴者向けに複数のプラットフォームを横断し、
女優ベースで作品レビュー・ランキング・キャンペーン速報をまとめるアフィリエイトサイトです。

## 特徴

- **女優図鑑**: 女優ごとの出演傾向・対応サービス・指名データを網羅
- **ジャンル／ランキング**: 検索意図に合わせたジャンル別ページと週次ランキング
- **作品レビュー**: プロバイダ横断のレビューカードで比較を可視化
- **キャンペーン速報**: DMM / APEX / SOKMIL / DTI の最新割引・サブスク情報を集約
- **アフィリエイト対応**: 各サービスのリンク生成をカスタム可能

## ユーザー向け機能

| 機能 | 説明 | データ保存 |
|------|------|-----------|
| 作品比較 | 複数作品を並べて価格・スペック比較 | LocalStorage |
| 一括選択 | チェックボックスで複数選択→まとめて比較/お気に入り追加 | LocalStorage |
| ホームカスタマイズ | トップページの表示セクション並び替え・表示/非表示 | LocalStorage |
| スワイプUI | Tinder風の作品発見インターフェース | LocalStorage |
| お気に入り | 作品・女優をお気に入り登録 | LocalStorage |
| あとで見る | ウォッチリスト機能 | LocalStorage |
| 価格アラート | 価格下落時の通知設定 | LocalStorage |
| レビュー投稿 | 作品へのレビュー・評価投稿（AI審査付き） | DB (Firebase) |
| タグ提案 | 作品へのタグ提案・投票 | DB |
| 出演者提案 | 作品への出演者情報提案・投票 | DB |
| 公開リスト | お気に入りリストの作成・公開・共有 | DB |

## パフォーマンス・SEO

| 最適化項目 | 効果 |
|-----------|------|
| Dynamic Import (recharts) | バンドル~70KB削減 |
| Firebase遅延初期化 | FCP ~300ms改善 |
| LCP画像priority | LCP ~500ms改善 |
| HowTo/AggregateOfferスキーマ | リッチスニペット表示 |
| 多言語メタディスクリプション | 言語別CTR最適化 |

## 技術スタック

- **フレームワーク**: Next.js 16 (App Router)
- **言語**: TypeScript
- **スタイリング**: Tailwind CSS 4
- **データベース**: PostgreSQL + Drizzle ORM
- **検索**: Meilisearch
- **監視**: Sentry (エラー監視)
- **分析**: Google Analytics 4 + A/Bテスト
- **デプロイ**: Firebase App Hosting / Google Cloud Run

## プロジェクト構成

```
adult-v/
├── apps/
│   ├── web/                    # MGS版サイト (mgs.style)
│   │   ├── app/[locale]/       # ページ (国際化対応)
│   │   ├── components/         # UIコンポーネント
│   │   └── lib/                # ユーティリティ (shared re-export)
│   └── fanza/                  # FANZA版サイト (fanza.style)
│       ├── app/[locale]/       # ページ (国際化対応)
│       ├── components/         # UIコンポーネント
│       └── lib/                # ユーティリティ (shared re-export)
├── packages/
│   ├── shared/                 # 共通ライブラリ
│   │   ├── src/components/     # 共通コンポーネント
│   │   ├── src/db-queries/     # DBクエリ
│   │   ├── src/lib/            # ユーティリティ関数
│   │   └── src/types/          # 型定義
│   ├── crawlers/               # クローラー・データ収集
│   ├── database/               # Drizzle設定・スキーマ
│   └── ui-common/              # 共通UIコンポーネント
├── drizzle/
│   └── migrations/             # DBマイグレーション
├── __tests__/                  # テスト
│   ├── unit/                   # ユニットテスト
│   └── integration/            # 統合テスト
└── scripts/                    # デプロイ・運用スクリプト
```

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.local.example` をコピーして `.env.local` を作成：

```bash
cp .env.local.example .env.local
```

必須の環境変数：

```
DATABASE_URL=postgresql://...
MEILISEARCH_HOST=...
MEILISEARCH_API_KEY=...
```

### 3. 開発サーバーの起動

```bash
npm run dev:web    # MGS版 (localhost:3000)
npm run dev:fanza  # FANZA版 (localhost:3000)
```

### 4. 言語設定

言語はGETパラメータ `hl` で指定します：

| 言語 | URL |
|------|-----|
| 日本語 | http://localhost:3000?hl=ja |
| 英語 | http://localhost:3000?hl=en |
| 中国語(簡体) | http://localhost:3000?hl=zh |
| 中国語(繁体) | http://localhost:3000?hl=zh-TW |
| 韓国語 | http://localhost:3000?hl=ko |

**例**: `http://localhost:3000/products/123?hl=en` で英語表示

## テスト

```bash
# 全テスト実行
npm test

# ウォッチモード
npm run test:watch

# カバレッジ付き
npm run test:coverage

# 特定ファイルのみ
npm test -- __tests__/unit/db-queries/price-history.test.ts
```

### テストファイル構成

| カテゴリ | テスト数 | 内容 |
|---------|---------|------|
| ユニットテスト | 400+ | hooks, components, lib, db-queries |
| 統合テスト | 50+ | API handlers, DB queries |
| E2Eテスト | 150+ | ページ遷移, UI操作, パフォーマンス |
| **合計** | **600+** | |

**主要テストファイル:**
- `useCompareList.test.ts` - 比較機能
- `useBulkSelection.test.ts` - 一括選択
- `useHomeSections.test.ts` - ホームカスタマイズ
- `seo.test.ts` - SEO構造化データ
- `user-contributions.test.ts` - レビュー/タグ/出演者提案
- `price-alerts.test.ts` - 価格アラート
- `hydration-errors.spec.ts` - ハイドレーションエラー検出

## ビルド

```bash
# 全アプリビルド
npm run build

# 個別ビルド
npm run build:web
npm run build:fanza

# TypeScriptチェック
npm run typecheck
```

## DBマイグレーション

```bash
# マイグレーション生成
npx drizzle-kit generate

# マイグレーション実行
npx drizzle-kit migrate
```

## デプロイ

### Firebase App Hosting

```bash
firebase deploy --only hosting
```

### Google Cloud Run (クローラー)

```bash
gcloud builds submit --config=cloud-build/cloudbuild-crawler.yaml
```

## アフィリエイト対応ASP

| ASP | 用途 |
|-----|------|
| DMM/FANZA | 主要コンテンツ |
| MGS | 主要コンテンツ |
| APEX | サブスク |
| SOKMIL | サブスク |
| DTI | 配信 |

## ライセンス

MIT License

## 注意事項

- 本サイトは各ASPのアフィリエイトプログラムを利用します
- 各プログラムの利用規約・年齢確認ポリシーを遵守してください
- プライバシーポリシーおよび年齢確認の導線を明記してください
