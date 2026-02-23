# テスト環境ドキュメント

## 概要

本プロジェクトでは以下のテストフレームワークを使用しています。

| 種類             | フレームワーク | 用途                                       |
| ---------------- | -------------- | ------------------------------------------ |
| ユニットテスト   | Vitest         | ユーティリティ関数、コンポーネントロジック |
| E2Eテスト        | Playwright     | ブラウザベースの統合テスト                 |
| アクセシビリティ | axe-core       | WCAG準拠チェック                           |

---

## テスト実行コマンド

### ユニットテスト

```bash
# 全ユニットテスト実行
pnpm run test:run

# ウォッチモード
pnpm run test:watch

# カバレッジ付き
pnpm run test:coverage
```

### E2Eテスト

```bash
# 全E2Eテスト実行
pnpm run test:e2e

# UIモード（デバッグ用）
pnpm run test:e2e:ui

# ブラウザ表示モード
pnpm run test:e2e:headed

# webプロジェクトのみ
pnpm run test:e2e:web

# fanzaプロジェクトのみ
pnpm run test:e2e:fanza

# デバッグモード
pnpm run test:e2e:debug
```

### 特化テスト

```bash
# アクセシビリティテスト
pnpm run test:a11y

# ビジュアルリグレッション
pnpm run test:visual

# スナップショット更新
pnpm run test:visual:update

# APIテスト
pnpm run test:api

# 全テスト実行
pnpm run test:all
```

---

## テストファイル構成

```
adult-v/
├── __tests__/                    # ユニットテスト
│   ├── lib/                      # ライブラリテスト
│   │   ├── provider-utils.test.ts
│   │   ├── seo.test.ts
│   │   ├── analytics-events.test.ts
│   │   └── cron-auth.test.ts
│   ├── hooks/                    # フックテスト
│   │   └── useFavorites.test.ts
│   ├── utils/                    # ユーティリティテスト
│   │   └── formatters.test.ts
│   └── crawlers/                 # クローラーテスト
│       └── performer-validation.test.ts
├── e2e/                          # E2Eテスト
│   ├── api-routes.spec.ts        # APIエンドポイント
│   ├── basic-navigation.spec.ts  # 基本ナビゲーション
│   ├── accessibility.spec.ts     # アクセシビリティ
│   ├── visual-regression.spec.ts # ビジュアルリグレッション
│   ├── performance.spec.ts       # パフォーマンス
│   ├── ui-interactions.spec.ts   # UI操作
│   ├── ab-testing.spec.ts        # A/Bテスト
│   ├── requirements-validation.spec.ts  # 要件検証
│   └── ...
├── vitest.config.mts             # Vitest設定
├── vitest.setup.ts               # Vitestセットアップ
└── playwright.config.ts          # Playwright設定
```

---

## 設定ファイル

### vitest.config.mts

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['__tests__/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules/**', 'e2e/**', '.next/**', '__tests__/legacy/**'],
    testTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@adult-v/shared': path.resolve(__dirname, './packages/shared/src'),
      '@adult-v/database': path.resolve(__dirname, './packages/database/src'),
    },
  },
});
```

### playwright.config.ts

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  timeout: process.env.CI ? 60000 : 120000,

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'web',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:3000',
      },
    },
    {
      name: 'fanza',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:3001',
      },
    },
  ],

  webServer: [
    {
      command: 'pnpm run dev:web',
      url: 'http://localhost:3000',
      timeout: 120000,
      reuseExistingServer: true,
    },
    {
      command: 'pnpm run dev:fanza',
      url: 'http://localhost:3001',
      timeout: 120000,
      reuseExistingServer: true,
    },
  ],
});
```

---

## テストカテゴリ

### 1. ユニットテスト

| テスト対象                 | ファイル                       | 説明                         |
| -------------------------- | ------------------------------ | ---------------------------- |
| ASP/プロバイダーマッピング | `provider-utils.test.ts`       | ASP名からProviderIDへの変換  |
| SEOユーティリティ          | `seo.test.ts`                  | メタデータ生成、構造化データ |
| 演者バリデーション         | `performer-validation.test.ts` | 演者名の検証・正規化         |
| アナリティクスイベント     | `analytics-events.test.ts`     | GA4イベント送信              |

### 2. E2Eテスト

| テスト対象           | ファイル                          | 説明                          |
| -------------------- | --------------------------------- | ----------------------------- |
| API動作              | `api-routes.spec.ts`              | 全APIエンドポイントの動作確認 |
| ページナビゲーション | `basic-navigation.spec.ts`        | 基本的なページ遷移            |
| アクセシビリティ     | `accessibility.spec.ts`           | axe-coreによるWCAG検証        |
| ビジュアル           | `visual-regression.spec.ts`       | スクリーンショット比較        |
| パフォーマンス       | `performance.spec.ts`             | Core Web Vitals               |
| 要件検証             | `requirements-validation.spec.ts` | REQUIREMENTS.md準拠           |

### 3. 要件検証テスト

`requirements-validation.spec.ts` はREQUIREMENTS.mdに定義された要件の実装を検証します。

| 要件    | テスト内容                      |
| ------- | ------------------------------- |
| 要件1-4 | 商品・演者・ASP紐付けの表示確認 |
| 要件5   | セール情報の表示確認            |
| 要件7   | 多言語ページの表示確認          |
| 要件8   | UI/UXの動作確認                 |
| 要件9   | SEOメタタグ・構造化データ       |
| 要件12  | Google Analyticsスクリプト      |
| 要件13  | PWA機能（SW, manifest）         |
| 要件14  | 年齢確認ページ                  |
| 要件18  | API動作確認                     |

---

## CI/CD (GitHub Actions)

### ワークフロー構成

```yaml
# .github/workflows/ci.yml
jobs:
  lint: # ESLint
  typecheck: # TypeScript型チェック
  unit-test: # Vitestユニットテスト
  build: # Next.jsビルド (web/fanza)
  e2e-test: # Playwright E2Eテスト
```

### トリガー

- `push` to master/main
- `pull_request` to master/main

### 成果物

- カバレッジレポート（Codecov）
- Playwrightレポート（GitHub Artifacts）

---

## テスト作成ガイドライン

### ユニットテスト

```typescript
import { describe, it, expect } from 'vitest';

describe('機能名', () => {
  describe('関数名', () => {
    it('should 期待する動作', () => {
      expect(result).toBe(expected);
    });
  });
});
```

### E2Eテスト

```typescript
import { test, expect } from '@playwright/test';

test.describe('機能名', () => {
  test('should 期待する動作', async ({ page }) => {
    await page.goto('/path');
    await expect(page.locator('selector')).toBeVisible();
  });
});
```

### 命名規則

- テストファイル: `*.test.ts` (Vitest) / `*.spec.ts` (Playwright)
- テストケース: `should + 動詞 + 目的語`

---

## トラブルシューティング

### Vitest

```bash
# キャッシュクリア
pnpm vitest --clearCache

# 単一ファイル実行
pnpm vitest run __tests__/lib/seo.test.ts
```

### Playwright

```bash
# ブラウザ再インストール
pnpm exec playwright install

# トレースビューア
pnpm exec playwright show-trace trace.zip

# コードジェネレータ
pnpm exec playwright codegen localhost:3000
```

---

## カバレッジ目標

| 対象                   | 目標 |
| ---------------------- | ---- |
| ユーティリティ関数     | 80%  |
| コンポーネントロジック | 70%  |
| APIルート              | 60%  |
| E2E（主要フロー）      | 100% |
