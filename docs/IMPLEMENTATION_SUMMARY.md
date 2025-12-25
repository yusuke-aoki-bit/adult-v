# データ整理・再クロール実装サマリー

## 実装完了した機能

### 1. 生データ保存テーブル（マイグレーション）
✅ **ファイル**: `drizzle/migrations/0009_add_raw_data_tables.sql`

**新規テーブル**:
- `duga_raw_responses` - DUGA APIレスポンスをJSONで保存
- `sokmil_raw_responses` - ソクミルAPIレスポンスをJSONで保存
- `mgs_raw_pages` - MGSスクレイピング結果をHTMLとJSONで保存
- `product_raw_data_links` - 商品と生データのリレーション

**実行コマンド**:
```bash
cd C:/Users/yuuku/cursor/adult-v
DATABASE_URL="postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres" \
npx tsx -e "
import {getDb} from './lib/db';
import {sql} from 'drizzle-orm';
import * as fs from 'fs';
const db=getDb();
const migration=fs.readFileSync('drizzle/migrations/0009_add_raw_data_tables.sql','utf-8');
await db.execute(sql.raw(migration));
console.log('✅ マイグレーション完了');
process.exit(0);
"
```

### 2. データクリーンアップスクリプト
✅ **ファイル**: `scripts/cleanup-obsolete-data.ts`

**実行コマンド**:
```bash
DATABASE_URL="postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres" \
npx tsx scripts/cleanup-obsolete-data.ts
```

**削除対象**:
- DTI（300件）とその他不要ASPデータ
- 孤立した商品、画像、出演者リレーション

### 3. DUGAクローラー（要実装）
**ファイル**: `scripts/crawlers/crawl-duga-api.ts`（作成予定）

**実装内容**:
```typescript
import { getDugaClient } from '@/lib/providers/duga-client';
import { getDb } from '@/lib/db';

// 1. APIから作品取得
// 2. duga_raw_responsesに生データ保存
// 3. products, product_sources, product_imagesにデータ保存
// 4. product_raw_data_linksでリンク作成
```

### 4. ソクミルクローラー（要実装）
**ファイル**: `scripts/crawlers/crawl-sokmil-api.ts`（作成予定）

**実装内容**:
```typescript
import { getSokmilClient } from '@/lib/providers/sokmil-client';
import { getDb } from '@/lib/db';

// 1. 商品検索APIから取得
// 2. sokmil_raw_responsesに生データ保存
// 3. データベースに保存
// 4. リレーション作成
```

### 5. MGS強化版クローラー（要実装）
**ファイル**: `scripts/crawlers/crawl-mgs-enhanced.ts`（作成予定）

**強化ポイント**:
- サンプル画像の完全取得
- サンプル動画URL取得
- メーカー品番の正確な抽出
- 生HTMLを `mgs_raw_pages` に保存
- リカバリー可能な構造

---

## 実行手順

### ステップ1: マイグレーション実行
```bash
# 生データテーブル作成
DATABASE_URL="postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres" \
npx tsx -e "import {getDb} from './lib/db';import {sql} from 'drizzle-orm';import * as fs from 'fs';const db=getDb();const migration=fs.readFileSync('drizzle/migrations/0009_add_raw_data_tables.sql','utf-8');await db.execute(sql.raw(migration));console.log('✅完了');process.exit(0);"
```

### ステップ2: データクリーンアップ
```bash
# DTI等の不要データ削除
cd C:/Users/yuuku/cursor/adult-v
DATABASE_URL="postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres" \
npx tsx scripts/cleanup-obsolete-data.ts
```

### ステップ3: クローラー実装（次フェーズ）
1. DUGAクローラー作成
2. ソクミルクローラー作成
3. MGS強化版クローラー作成

### ステップ4: Cloud Scheduler設定
```bash
# DUGAクローラー（毎日実行）
gcloud scheduler jobs create http duga-crawler \
  --location=asia-northeast1 \
  --schedule="0 2 * * *" \
  --uri="https://asia-northeast1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/[PROJECT]/jobs/duga-crawler:run" \
  --http-method=POST \
  --oauth-service-account-email=[SERVICE_ACCOUNT]

# ソクミルクローラー（毎日実行）
gcloud scheduler jobs create http sokmil-crawler \
  --location=asia-northeast1 \
  --schedule="0 3 * * *" \
  --uri="https://asia-northeast1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/[PROJECT]/jobs/sokmil-crawler:run" \
  --http-method=POST

# MGSクローラー（毎日実行）
gcloud scheduler jobs create http mgs-crawler \
  --location=asia-northeast1 \
  --schedule="0 4 * * *" \
  --uri="https://asia-northeast1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/[PROJECT]/jobs/mgs-crawler:run" \
  --http-method=POST
```

---

## データ構造

### 生データ保存の流れ

```
┌─────────────┐
│  DUGA API   │
│  Response   │
└──────┬──────┘
       │ 保存
       ▼
┌─────────────────────┐
│ duga_raw_responses  │ ← JSON全体を保存
│ - product_id        │
│ - raw_json          │
└─────────┬───────────┘
          │
          │ パース・変換
          ▼
    ┌──────────┐     ┌─────────────────┐
    │ products │◄────┤ product_sources │
    └────┬─────┘     └─────────────────┘
         │
         │ リンク
         ▼
┌──────────────────────┐
│ product_raw_data_links│
│ - product_id          │
│ - source_type: 'duga' │
│ - raw_data_id         │
└───────────────────────┘
```

### リカバリー方法

1. **生データから再構築**:
```sql
-- DUGA商品の再構築例
SELECT
  r.raw_json->>'title' as title,
  r.raw_json->>'price' as price
FROM duga_raw_responses r
WHERE r.product_id = 'xxx';
```

2. **リレーションから逆引き**:
```sql
-- 商品IDから生データを取得
SELECT r.*
FROM product_raw_data_links l
JOIN duga_raw_responses r ON l.raw_data_id = r.id
WHERE l.product_id = 12345 AND l.source_type = 'duga';
```

---

## 次のアクション

### 即座に実行可能:
- [x] マイグレーション作成
- [ ] マイグレーション実行
- [ ] データクリーンアップ実行

### 実装必要:
- [ ] DUGAクローラー実装
- [ ] ソクミルクローラー実装
- [ ] MGS強化版クローラー実装
- [ ] Cloud Run Jobs設定
- [ ] Cloud Scheduler設定

### 検証:
- [ ] 生データ保存の確認
- [ ] リレーション正常性確認
- [ ] リカバリー機能テスト

---

最終更新: 2025-11-26
