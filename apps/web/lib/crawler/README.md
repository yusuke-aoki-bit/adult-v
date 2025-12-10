# Crawler Utilities

クローラー共通ユーティリティライブラリ

## 概要

このライブラリは、各種クローラーで共通して使用する機能を提供します：

- **リトライ処理** - 一時的なエラーの自動リトライ
- **タイムアウト処理** - リクエストのタイムアウト管理
- **レート制限** - API/サイトへのリクエスト頻度制御
- **AI機能** - タグ抽出、翻訳、説明文生成
- **重複防止** - 生データとproductsの紐付け管理

## インストール

```typescript
import {
  // リトライ
  withRetry,
  fetchWithRetry,

  // タイムアウト
  fetchWithTimeout,
  TimeoutError,

  // レート制限
  RateLimiter,
  getRateLimiterForSite,

  // AI機能
  CrawlerAIHelper,
  processProductWithAI,

  // 重複防止
  checkDugaRawData,
  upsertDugaRawData,
  linkProductToRawData,
  markRawDataAsProcessed,

  // 統合fetch
  robustFetch,

  // ログ
  crawlerLog,
} from '../lib/crawler';
```

## 使い方

### 1. 堅牢なfetch（推奨）

```typescript
import { robustFetch, RateLimiter } from '../lib/crawler';

const limiter = new RateLimiter({ minDelayMs: 1000, addJitter: true });

const response = await robustFetch('https://api.example.com/data', {
  timeoutMs: 10000,
  retry: { maxRetries: 3 },
  rateLimiter: limiter,
});
```

### 2. 重複防止ヘルパー

生データの重複チェックと商品との紐付けを管理：

```typescript
import {
  checkDugaRawData,
  upsertDugaRawData,
  linkProductToRawData,
  markRawDataAsProcessed,
  calculateJsonHash,
} from '../lib/crawler';

// APIレスポンスを取得
const apiResponse = await fetchDugaApi(productId);

// 1. 重複チェック
const check = await checkDugaRawData(productId, apiResponse);

if (check.exists && !check.hasChanged) {
  // データに変更なし、スキップ
  console.log('No changes detected, skipping...');
  return;
}

// 2. 生データ保存/更新
const { id: rawDataId, isNew } = await upsertDugaRawData(
  productId,
  apiResponse,
  check.newHash
);

// 3. productsテーブルに保存
const productId = await saveToProducts(apiResponse);

// 4. 生データとproductsをリンク
const link = await linkProductToRawData(
  productId,
  'duga',
  rawDataId,
  'duga_raw_responses',
  check.newHash
);

if (link.needsReprocessing) {
  // コンテンツが変更された場合、再処理が必要
  await reprocessProduct(productId);
}

// 5. 処理完了をマーク
await markRawDataAsProcessed('duga', rawDataId);
```

### 3. AI機能

```typescript
import { CrawlerAIHelper, processProductWithAI } from '../lib/crawler';

// シンプルな使い方
const result = await processProductWithAI({
  title: '作品タイトル',
  description: '作品説明',
  performers: ['出演者A'],
  genres: ['ジャンル1', 'ジャンル2'],
});

console.log(result.tags);        // { genres: [...], attributes: [...], ... }
console.log(result.translations); // { en: {...}, zh: {...}, ko: {...} }

// クラスを使った詳細な制御
const aiHelper = new CrawlerAIHelper();

// タグ抽出のみ
const tags = await aiHelper.extractTags('作品タイトル', '説明');

// 翻訳のみ
const translations = await aiHelper.translate('タイトル', '説明');

// 一括処理
const results = await aiHelper.processProducts(products, {
  extractTags: true,
  translate: true,
  generateDescription: false,
}, 500); // 500msの遅延
```

### 4. レート制限

```typescript
import { RateLimiter, getRateLimiterForSite, SITE_RATE_LIMITS } from '../lib/crawler';

// サイト別のプリセットを使用
const limiter = getRateLimiterForSite('duga');

// カスタム設定
const customLimiter = new RateLimiter({
  minDelayMs: 2000,
  maxConcurrent: 3,
  addJitter: true,
  jitterRange: 500,
});

// 使用方法1: wait/done パターン
await limiter.wait();
try {
  await fetch(url);
} finally {
  limiter.done();
}

// 使用方法2: execute パターン（推奨）
const result = await limiter.execute(async () => {
  return await fetch(url);
});
```

## 重複防止の仕組み

### 生データテーブル

| テーブル | 用途 |
|---------|------|
| `duga_raw_responses` | DUGA APIレスポンス |
| `sokmil_raw_responses` | ソクミルAPIレスポンス |
| `mgs_raw_pages` | MGSスクレイピング結果 |
| `raw_html_data` | 汎用HTMLデータ（DTI, FC2等） |
| `raw_csv_data` | CSVインポートデータ |

### product_raw_data_links

生データとproductsの関係を管理：

```sql
CREATE TABLE product_raw_data_links (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id),
  source_type TEXT NOT NULL,      -- 'duga', 'sokmil', 'mgs', etc.
  raw_data_id INTEGER NOT NULL,
  raw_data_table TEXT NOT NULL,   -- 参照先テーブル名
  content_hash VARCHAR(64),       -- 処理時点のハッシュ
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 重複検出フロー

1. **クロール時**: 取得データのハッシュを計算
2. **既存チェック**: 既存の生データとハッシュを比較
3. **変更なし**: スキップ（無駄な処理を回避）
4. **変更あり**: 生データを更新し、再処理フラグを立てる
5. **リンク更新**: `content_hash`を更新して再処理検出可能に

## ログ出力

```typescript
import { crawlerLog } from '../lib/crawler';

crawlerLog.info('処理開始');
crawlerLog.success('処理完了');
crawlerLog.warn('警告メッセージ');
crawlerLog.error('エラー発生');
crawlerLog.progress(50, 100, 'メッセージ'); // 📊 50/100 (50%) - メッセージ
```

## サイト別レート制限設定

| サイト | 最小間隔 | ジッター |
|-------|---------|----------|
| DTI | 500ms | 300ms |
| DUGA | 1000ms | なし |
| MGS | 2000ms | 500ms |
| FC2 | 3000ms | 1000ms |
| Japanska | 1500ms | 500ms |
| Sokmil | 1000ms | 300ms |
