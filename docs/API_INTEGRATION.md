# DUGA / Sokmil API連携ガイド

このドキュメントでは、DUGA（APEX）およびソクミルのアフィリエイトAPIを利用したデータ収集機能の実装について説明します。

## 概要

### 実装されたAPI

1. **DUGA (APEX) Web Service API**
   - エンドポイント: `https://duga.jp/aff/api/search` (推定)
   - レート制限: 60リクエスト/60秒
   - APIバージョン: 1.2
   - ドキュメント: https://duga.jp/aff/member/webservice/

2. **ソクミル (Sokmil) Affiliate API**
   - 7種類のAPI提供:
     - 商品検索API (`api_m_item`)
     - メーカー検索API (`api_m_maker`)
     - レーベル検索API (`api_m_label`)
     - シリーズ検索API (`api_m_series`)
     - ジャンル検索API (`api_m_genre`)
     - 監督検索API (`api_m_director`)
     - 出演者検索API (`api_m_actor`)
   - ドキュメント: https://sokmil-ad.com/member/api

## セットアップ

### 1. 環境変数の設定

`.env.local` ファイルに以下の環境変数を追加:

```bash
# DUGA (APEX) Web Service API
DUGA_APP_ID=WzsUOEt2124UD65BqsHU
DUGA_AGENT_ID=<あなたの代理店ID>
DUGA_BANNER_ID=01

# ソクミル (Sokmil) Affiliate API
SOKMIL_API_KEY=70c75ce3a36c1f503f2515ff094d6f60
```

**重要**: `DUGA_AGENT_ID` は、DUGAアフィリエイト管理画面から取得する必要があります。

### 2. クレジット表示の実装（必須）

#### DUGA APIクレジット

```tsx
import { DugaCredit } from '@/components/credits/DugaCredit';

// フッターまたは適切な場所に配置
<DugaCredit variant="small" className="my-4" />;
```

#### ソクミルAPIクレジット

```tsx
import { SokmilCredit } from '@/components/credits/SokmilCredit';

// 2つのサイズから選択可能
<SokmilCredit variant="88x31" className="my-4" />
// または
<SokmilCredit variant="135x18" className="my-4" />
```

**注意**: クレジット表示は、両APIの利用規約により**必須**です。表示しない場合、API利用停止の可能性があります。

## API クライアントの使い方

### DUGA API Client

#### 基本的な使い方

```typescript
import { getDugaClient } from '@/lib/providers/duga-client';

// シングルトンインスタンスを取得
const dugaClient = getDugaClient();

// キーワード検索
const results = await dugaClient.searchByKeyword('女優名', {
  hits: 20,
  sort: 'new',
  adult: 1,
});

console.log(`検索結果: ${results.count}件`);
console.log('商品一覧:', results.items);
```

#### 出演者で検索

```typescript
const performerResults = await dugaClient.searchByPerformer('performer-id-123', {
  hits: 50,
  offset: 0,
});
```

#### 新着作品を取得

```typescript
const newReleases = await dugaClient.getNewReleases(20, 0);
```

#### 人気作品を取得

```typescript
const popularProducts = await dugaClient.getPopularProducts(20, 0);
```

#### 詳細な検索

```typescript
const searchResults = await dugaClient.searchProducts({
  keyword: '検索ワード',
  hits: 50,
  offset: 0,
  sort: 'release', // 発売日順
  target: 'hd', // HD版のみ
  device: 'smart', // スマホ対応
  releasestt: '20240101', // 2024年1月1日以降
  releaseend: '20241231', // 2024年12月31日まで
});
```

#### レート制限の処理

```typescript
import { RateLimitError } from '@/lib/providers/duga-client';

try {
  const results = await dugaClient.searchProducts({ keyword: 'test' });
} catch (error) {
  if (error instanceof RateLimitError) {
    console.error('レート制限エラー: 60秒間に60リクエストを超えています');
    // リトライロジックを実装
  } else {
    console.error('API エラー:', error);
  }
}
```

### Sokmil API Client

#### 基本的な使い方

```typescript
import { getSokmilClient } from '@/lib/providers/sokmil-client';

// シングルトンインスタンスを取得
const sokmilClient = getSokmilClient();

// 商品名で検索
const results = await sokmilClient.searchByItemName('商品名', 1, 20);

console.log(`総件数: ${results.totalCount}`);
console.log(`現在のページ: ${results.currentPage}`);
console.log('商品一覧:', results.data);
```

#### 商品IDで取得

```typescript
const product = await sokmilClient.getItemById('item-id-123');
if (product) {
  console.log('商品名:', product.itemName);
  console.log('価格:', product.price);
  console.log('出演者:', product.actors);
}
```

#### 出演者で検索

```typescript
const actorProducts = await sokmilClient.searchByActor('actor-id-456', 1, 50);
```

#### 新着商品を取得

```typescript
const newItems = await sokmilClient.getNewReleases(1, 20);
```

#### メーカー、レーベル、ジャンル検索

```typescript
// メーカー検索
const makers = await sokmilClient.searchMakers({
  maker_name: 'メーカー名',
  page: 1,
  per_page: 20,
});

// レーベル検索
const labels = await sokmilClient.searchLabels({
  label_name: 'レーベル名',
  maker_id: 'maker-123',
});

// ジャンル検索
const genres = await sokmilClient.searchGenres({
  genre_name: 'ジャンル名',
});

// 出演者検索
const actors = await sokmilClient.searchActors({
  actor_name: '女優名',
});
```

#### 詳細な商品検索

```typescript
const searchResults = await sokmilClient.searchItems({
  item_name: '商品名',
  maker_id: 'maker-123',
  label_id: 'label-456',
  genre_id: 'genre-789',
  actor_id: 'actor-abc',
  release_date_from: '2024-01-01',
  release_date_to: '2024-12-31',
  sort: 'release_date_desc',
  page: 1,
  per_page: 50,
});
```

## データ構造

### DUGA Product

```typescript
interface DugaProduct {
  productId: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  packageUrl?: string;
  sampleImages?: string[];
  sampleVideos?: string[];
  affiliateUrl: string;
  price?: number;
  releaseDate?: string;
  duration?: number;
  label?: string;
  series?: string;
  performers?: Array<{ id: string; name: string }>;
  categories?: Array<{ id: string; name: string }>;
  salesType?: string;
  adult?: 0 | 1;
  multiDevice?: boolean;
}
```

### Sokmil Product

```typescript
interface SokmilProduct {
  itemId: string;
  itemName: string;
  itemUrl: string;
  affiliateUrl: string;
  thumbnailUrl?: string;
  packageImageUrl?: string;
  sampleImages?: string[];
  price?: number;
  releaseDate?: string;
  duration?: number;
  maker?: { id: string; name: string };
  label?: { id: string; name: string };
  series?: { id: string; name: string };
  genres?: Array<{ id: string; name: string }>;
  directors?: Array<{ id: string; name: string }>;
  actors?: Array<{ id: string; name: string }>;
  description?: string;
}
```

## クローラー実装例

### DUGA クローラー

```typescript
import { getDugaClient } from '@/lib/providers/duga-client';
import { getDb } from '@/lib/db';
import { products, productSources, productImages } from '@/lib/db/schema';

async function crawlDugaProducts() {
  const client = getDugaClient();
  const db = getDb();

  let offset = 0;
  const batchSize = 100;

  while (true) {
    try {
      // 新着作品を取得
      const response = await client.getNewReleases(batchSize, offset);

      if (response.items.length === 0) break;

      for (const item of response.items) {
        // データベースに保存
        const [product] = await db
          .insert(products)
          .values({
            title: item.title,
            description: item.description,
            defaultThumbnailUrl: item.thumbnailUrl,
            releaseDate: item.releaseDate,
            duration: item.duration,
          })
          .onConflictDoUpdate({
            target: products.id,
            set: {
              updatedAt: new Date(),
            },
          })
          .returning();

        // product_sources に保存
        await db.insert(productSources).values({
          productId: product.id,
          aspName: 'DUGA',
          originalProductId: item.productId,
          affiliateUrl: item.affiliateUrl,
          price: item.price,
        });

        // サンプル画像を保存
        if (item.sampleImages) {
          for (const [index, imageUrl] of item.sampleImages.entries()) {
            await db.insert(productImages).values({
              productId: product.id,
              aspName: 'DUGA',
              imageUrl,
              imageType: 'sample',
              displayOrder: index,
            });
          }
        }
      }

      console.log(`処理済み: ${offset + response.items.length}/${response.count}`);
      offset += batchSize;

      // レート制限対策: 1秒待機
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('クローラーエラー:', error);
      break;
    }
  }
}
```

### ソクミル クローラー

```typescript
import { getSokmilClient } from '@/lib/providers/sokmil-client';

async function crawlSokmilProducts() {
  const client = getSokmilClient();
  const db = getDb();

  let page = 1;
  const perPage = 100;

  while (true) {
    try {
      const response = await client.getNewReleases(page, perPage);

      if (response.data.length === 0) break;

      for (const item of response.data) {
        // 同様にデータベースに保存
        // ...
      }

      console.log(`処理済み: ページ ${page}/${Math.ceil(response.totalCount / perPage)}`);

      if (page * perPage >= response.totalCount) break;
      page++;

      // API負荷軽減のため待機
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error('クローラーエラー:', error);
      break;
    }
  }
}
```

## 利用規約とベストプラクティス

### DUGA API

1. **レート制限**: 60リクエスト/60秒を厳守
2. **クレジット表示**: すべてのページに必須
3. **キャッシング**: 頻繁なアクセスを避けるため、レスポンスをキャッシュ推奨
4. **エラーハンドリング**: レート制限エラーを適切に処理

### ソクミル API

1. **クレジット表示**: すべてのページに必須
2. **適切なページネーション**: 大量データ取得時は複数リクエストに分割
3. **キャッシング**: 同一データへの重複アクセスを避ける

## トラブルシューティング

### よくある問題

#### 1. 「DUGA_AGENT_ID must be set」エラー

**原因**: 環境変数が設定されていない

**解決策**:

```bash
# .env.local に追加
DUGA_AGENT_ID=あなたの代理店ID
```

#### 2. レート制限エラー

**原因**: 60秒間に60回以上のリクエスト

**解決策**:

```typescript
// リクエスト間に待機時間を追加
await new Promise((resolve) => setTimeout(resolve, 1000));
```

#### 3. API レスポンスが空

**原因**:

- APIエンドポイントURLが間違っている
- APIキーが無効
- 検索条件が厳しすぎる

**解決策**:

- APIドキュメントで正しいエンドポイントを確認
- APIキーの有効性を確認
- より広い検索条件で試す

## 参考リンク

- [DUGA アフィリエイト管理画面](https://duga.jp/aff/member/)
- [DUGA API ドキュメント](https://duga.jp/aff/member/webservice/)
- [DUGA API 利用規約](https://duga.jp/aff/member/html/api-rule.html)
- [DUGA クレジット表示方法](https://duga.jp/aff/member/html/api-credit.html)
- [ソクミル アフィリエイト管理画面](https://sokmil-ad.com/member/)
- [ソクミル API ドキュメント](https://sokmil-ad.com/member/api)

## サポート

API実装に関する質問や問題がある場合:

1. 各APIの公式ドキュメントを確認
2. アフィリエイト管理画面のお問い合わせフォームを利用
3. プロジェクトのissueトラッカーに報告

---

最終更新日: 2025-11-26
