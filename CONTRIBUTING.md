# コントリビューションガイド

このドキュメントでは、本プロジェクトへの貢献方法を説明します。

## 目次

1. [開発環境セットアップ](#開発環境セットアップ)
2. [開発フロー](#開発フロー)
3. [コード規約](#コード規約)
4. [コミット規約](#コミット規約)
5. [テスト](#テスト)
6. [プルリクエスト](#プルリクエスト)
7. [デプロイ](#デプロイ)

---

## 開発環境セットアップ

### 必須ツール

| ツール     | バージョン | 備考                       |
| ---------- | ---------- | -------------------------- |
| Node.js    | 20.x       | `.node-version` 参照       |
| pnpm       | 9.15.0     | `corepack enable` で有効化 |
| PostgreSQL | 15+        | ローカル or Docker         |

### リポジトリ構成

```
adult-v/
├── apps/
│   ├── web/          # adult-v (メインサイト)
│   └── fanza/        # adult-v-1 (FANZAサイト)
├── packages/
│   ├── shared/       # 共通コンポーネント・ロジック
│   ├── database/     # Drizzle ORM スキーマ・マイグレーション
│   └── crawlers/     # データクロール
├── __tests__/        # テスト (unit / integration / e2e)
├── turbo.json        # Turborepo 設定
└── pnpm-workspace.yaml
```

### セットアップ手順

```bash
# 1. リポジトリをクローン
git clone <repository-url>
cd adult-v

# 2. pnpm を有効化 (未インストールの場合)
corepack enable
corepack prepare pnpm@9.15.0 --activate

# 3. 依存関係をインストール
pnpm install

# 4. 環境変数を設定
# 各アプリに .env.local を作成 (テンプレートは .env.example を参照)
cp apps/web/.env.example apps/web/.env.local
cp apps/fanza/.env.example apps/fanza/.env.local

# 5. データベースをセットアップ
pnpm db:generate   # Drizzle マイグレーションファイル生成
pnpm db:push       # スキーマをDBに反映

# 6. 開発サーバーを起動
pnpm dev           # 全アプリ同時起動
pnpm dev:web       # web のみ起動
pnpm dev:fanza     # fanza のみ起動
```

---

## 開発フロー

### ブランチ戦略

- **`master`** -- 本番ブランチ。直接プッシュ禁止。マージ時に自動デプロイ。
- **`feat/<説明>`** -- 新機能
- **`fix/<説明>`** -- バグ修正
- **`refactor/<説明>`** -- リファクタリング

```bash
# 例: 新機能ブランチを作成
git checkout master
git pull origin master
git checkout -b feat/add-user-profile
```

### 主要コマンド一覧

| コマンド            | 説明                         |
| ------------------- | ---------------------------- |
| `pnpm dev`          | 全アプリの開発サーバー起動   |
| `pnpm dev:web`      | web アプリのみ起動           |
| `pnpm dev:fanza`    | fanza アプリのみ起動         |
| `pnpm build`        | 全アプリをビルド             |
| `pnpm lint`         | ESLint 実行                  |
| `pnpm typecheck`    | TypeScript 型チェック        |
| `pnpm format`       | Prettier でフォーマット      |
| `pnpm format:check` | フォーマットチェック (CI用)  |
| `pnpm db:generate`  | Drizzle マイグレーション生成 |
| `pnpm db:push`      | DBスキーマ反映               |

---

## コード規約

### TypeScript

- **strict モード** + **`noUncheckedIndexedAccess: true`** を有効化。配列やオブジェクトのインデックスアクセスは `undefined` チェックが必須。
- ターゲット: ES2022

```typescript
// NG: noUncheckedIndexedAccess により items[0] は T | undefined
const first = items[0];
console.log(first.name); // コンパイルエラー

// OK: undefined チェックを行う
const first = items[0];
if (first) {
  console.log(first.name);
}
```

### Prettier

設定 (`.prettierrc`):

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 120,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf",
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

- `prettier-plugin-tailwindcss` により、Tailwind CSS のクラス名は自動でソートされる。

### ESLint

- ESLint v9 flat config 形式 (`eslint.config.mjs`)。
- 各アプリに個別の設定ファイルがある。

### Tailwind CSS テーマクラス

- ハードコードされた色値ではなく、テーマクラス (`bg-background`, `text-foreground`, `border-border` 等) を使用する。
- ダークモード対応は CSS 変数ベースで自動的に適用される。

### DI (依存性注入) パターン

`packages/shared` はアプリ固有のスキーマに依存しないよう、テーブルオブジェクトや演算子を引数として受け取る DI パターンを採用している。

```typescript
// packages/shared 側: テーブルを引数で受け取る
export function createProductQueries(tables: { products: ProductTable; sources: SourceTable }) {
  return {
    findById: (id: number) => db.select().from(tables.products).where(eq(tables.products.id, id)),
  };
}

// apps/web 側: アプリ固有のスキーマを注入
import { products, sources } from '@adult-v/database/schema';
const queries = createProductQueries({ products, sources });
```

### i18n (国際化)

- `next-intl` を使用。対応言語: ja, en, zh, zh-TW, ko
- メッセージファイル: `apps/<app>/messages/<locale>.json`
- 新しい文字列を追加する場合は、**全5言語のメッセージファイルを更新**すること。

---

## コミット規約

[Conventional Commits](https://www.conventionalcommits.org/) に準拠する。

### フォーマット

```
<type>: <description>
```

### type 一覧

| type       | 用途                            |
| ---------- | ------------------------------- |
| `feat`     | 新機能の追加                    |
| `fix`      | バグ修正                        |
| `refactor` | リファクタリング (機能変更なし) |
| `perf`     | パフォーマンス改善              |
| `docs`     | ドキュメントの変更              |
| `test`     | テストの追加・修正              |
| `ci`       | CI/CD 設定の変更                |
| `deps`     | 依存関係の更新                  |
| `chore`    | その他の雑務                    |

### 例

```
feat: ユーザープロフィールページを追加
fix: 検索結果のページネーションが正しく動作しない問題を修正
refactor: ProductCard コンポーネントを共通パッケージに移動
perf: getServerSiteMode で headers() を回避し ISR 有効化
test: 5xx エラー防止 E2E テスト追加
deps: Next.js を 16.0.7 にアップデート
```

### pre-commit フック

husky + lint-staged により、コミット時に以下が自動実行される:

- `*.{ts,tsx,js,jsx,mjs,cjs}` -- Prettier + ESLint
- `*.{json,md,yml,yaml,css}` -- Prettier

---

## テスト

### ユニットテスト / 統合テスト (Vitest)

```bash
pnpm test              # watch モードで実行
pnpm test:run          # 1回実行
pnpm test:unit         # ユニットテストのみ
pnpm test:integration  # 統合テストのみ
pnpm test:coverage     # カバレッジレポート付き
pnpm test:watch        # watch モード
```

テストファイルの配置:

```
__tests__/
├── unit/           # ユニットテスト
├── integration/    # 統合テスト
└── e2e/            # E2E テスト (Playwright)
```

### E2E テスト (Playwright)

```bash
pnpm test:e2e          # 全 E2E テスト実行
pnpm test:e2e:web      # web プロジェクトのみ
pnpm test:e2e:fanza    # fanza プロジェクトのみ
pnpm test:e2e:headed   # ブラウザ表示付き
pnpm test:e2e:ui       # Playwright UI モード
pnpm test:e2e:debug    # デバッグモード
pnpm test:a11y         # アクセシビリティテスト
pnpm test:visual       # ビジュアルリグレッションテスト
pnpm test:api          # API ルートテスト
pnpm test:perf         # パフォーマンステスト
```

### テストの追加方法

- ユニットテスト: `__tests__/unit/` にファイルを追加。ファイル名は `*.test.ts` とする。
- 統合テスト: `__tests__/integration/` にファイルを追加。
- E2E テスト: `__tests__/e2e/` に `*.spec.ts` ファイルを追加。
- 新機能にはユニットテストを必ず追加する。UI コンポーネントの変更にはビジュアルリグレッションテストの更新も検討する。

---

## プルリクエスト

### PR の作成手順

1. 機能ブランチで作業を完了し、プッシュする。
2. `master` ブランチに対して PR を作成する。
3. PR の説明に変更内容と動作確認方法を記載する。

### PR テンプレート

```markdown
## 概要

<!-- 変更内容を簡潔に説明 -->

## 変更点

- 変更1
- 変更2

## テスト方法

<!-- 動作確認の手順 -->

## スクリーンショット (該当する場合)

<!-- UI変更がある場合はスクリーンショットを添付 -->
```

### CI チェック (すべて通過が必須)

| チェック       | 内容                                     |
| -------------- | ---------------------------------------- |
| **Lint**       | ESLint による静的解析                    |
| **Format**     | Prettier によるフォーマットチェック      |
| **TypeCheck**  | TypeScript の型チェック                  |
| **Unit Tests** | Vitest によるユニットテスト + カバレッジ |
| **E2E Tests**  | Playwright による E2E テスト (PR時のみ)  |
| **Build**      | web / fanza 両アプリのビルド検証         |

すべてのチェックがパスするまでマージできない。ローカルでの事前確認:

```bash
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:run
```

---

## デプロイ

### 自動デプロイ

- **Firebase App Hosting** を使用。
- `master` ブランチへのマージ (プッシュ) をトリガーに自動デプロイが実行される。
- web (`adult-v`) と fanza (`adult-v-1`) は独立してデプロイされる。

### デプロイの流れ

```
PR マージ → master push → Firebase App Hosting 自動デプロイ
                        → Sentry ソースマップアップロード
```

### 注意事項

- `master` への直接プッシュは避け、必ず PR を経由する。
- デプロイに問題が発生した場合は、修正 PR を作成してマージする (revert も可)。
- Firebase App Hosting のビルドログはコンソールで確認できる。
