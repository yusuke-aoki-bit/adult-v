/**
 * Meilisearch client configuration
 *
 * Meilisearchを使用した高速全文検索
 * - 50ms以下のレスポンス
 * - タイポ許容
 * - 日本語対応
 * - ファセット検索
 */

import { MeiliSearch } from 'meilisearch';

// Meilisearchクライアントのシングルトンインスタンス
let meilisearchClient: MeiliSearch | null = null;

/**
 * Meilisearchクライアントを取得
 */
export function getMeilisearchClient(): MeiliSearch {
  if (!meilisearchClient) {
    const host = process.env['MEILISEARCH_HOST'] || 'http://localhost:7700';
    const apiKey = process.env['MEILISEARCH_API_KEY'] || 'masterKey';

    meilisearchClient = new MeiliSearch({
      host,
      apiKey,
    });
  }

  return meilisearchClient;
}

/**
 * 商品検索インデックス名
 */
export const PRODUCTS_INDEX = 'products';

/**
 * Meilisearch商品ドキュメントの型定義
 */
export interface MeilisearchProduct {
  id: number;
  normalizedProductId: string;
  originalProductIds: string[]; // すべてのoriginal_product_idの配列
  title: string;
  titleEn?: string;
  titleKo?: string;
  titleZh?: string;
  description?: string;
  releaseDate?: string;
  thumbnailUrl?: string;
  performers: string[]; // 女優名の配列
  performerIds: number[]; // 女優IDの配列
  tags: string[]; // タグ名の配列
  tagIds: number[]; // タグIDの配列
  providers: string[]; // プロバイダー名の配列 ['DMM', 'DUGA']
  price?: number;
  rating?: number;
}

/**
 * 商品インデックスの設定を初期化
 */
export async function initializeProductsIndex() {
  const client = getMeilisearchClient();
  const index = client.index(PRODUCTS_INDEX);

  try {
    // インデックスが存在するか確認
    await index.getRawInfo();
    console.log(`Index "${PRODUCTS_INDEX}" already exists`);
  } catch {
    // インデックスが存在しない場合は作成
    console.log(`Creating index "${PRODUCTS_INDEX}"...`);
    await client.createIndex(PRODUCTS_INDEX, { primaryKey: 'id' });
  }

  // 検索可能属性を設定
  await index.updateSearchableAttributes([
    'title',
    'titleEn',
    'titleKo',
    'titleZh',
    'normalizedProductId',
    'originalProductIds',
    'description',
    'performers',
    'tags',
  ]);

  // フィルタリング可能属性を設定
  await index.updateFilterableAttributes(['providers', 'performerIds', 'tagIds', 'price', 'rating', 'releaseDate']);

  // ソート可能属性を設定
  await index.updateSortableAttributes(['releaseDate', 'price', 'rating']);

  // ランキングルールを設定（関連性重視）
  await index.updateRankingRules([
    'words', // マッチする単語数
    'typo', // タイポ許容度
    'proximity', // 単語間の距離
    'attribute', // 属性の重要度
    'sort', // ソート
    'exactness', // 完全一致度
  ]);

  // タイポ許容設定
  await index.updateTypoTolerance({
    enabled: true,
    minWordSizeForTypos: {
      oneTypo: 4, // 4文字以上で1文字のタイポ許容
      twoTypos: 8, // 8文字以上で2文字のタイポ許容
    },
  });

  console.log(`Index "${PRODUCTS_INDEX}" configured successfully`);
}
