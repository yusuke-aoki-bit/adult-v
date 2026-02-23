/**
 * カーソルベースページネーション ユーティリティ
 *
 * オフセットベースより高パフォーマンスなページネーションを提供
 * - 大規模データセットでも一定のパフォーマンス
 * - リアルタイム更新時の重複/欠落防止
 */

import type { CursorData, ProductCursor } from '../db-queries/types';

/**
 * カーソルをエンコード
 * @param data カーソルデータ
 * @returns Base64エンコードされたカーソル文字列
 */
export function encodeCursor(data: CursorData): ProductCursor {
  const json = JSON.stringify(data);
  // ブラウザ/Node.js両対応
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(json, 'utf-8').toString('base64url');
  }
  return btoa(json);
}

/**
 * カーソルをデコード
 * @param cursor Base64エンコードされたカーソル文字列
 * @returns カーソルデータ、または無効な場合null
 */
export function decodeCursor(cursor: ProductCursor): CursorData | null {
  try {
    let json: string;
    if (typeof Buffer !== 'undefined') {
      json = Buffer.from(cursor, 'base64url').toString('utf-8');
    } else {
      json = atob(cursor);
    }
    const data = JSON.parse(json);

    // バリデーション: idは必須
    if (typeof data['id'] !== 'number') {
      return null;
    }

    // ソートタイプに応じたバリデーション
    const type = data.type || 'releaseDate';
    const validTypes = ['releaseDate', 'price', 'rating', 'reviewCount', 'duration', 'title'];
    if (!validTypes.includes(type)) {
      return null;
    }

    return {
      type,
      releaseDate: data['releaseDate'] ?? null,
      price: data['price'] ?? null,
      rating: data['rating'] ?? null,
      reviewCount: data['reviewCount'] ?? null,
      duration: data['duration'] ?? null,
      title: data['title'] ?? null,
      id: data['id'],
    };
  } catch {
    return null;
  }
}

/** ソートタイプの定義 */
export type CursorSortType = 'releaseDate' | 'price' | 'rating' | 'reviewCount' | 'duration' | 'title';

/**
 * 商品からカーソルデータを生成
 * @param product 商品オブジェクト
 * @param sortType ソートタイプ（デフォルト: 'releaseDate'）
 * @returns カーソルデータ
 */
export function createCursorFromProduct(
  product: {
    id: number | string;
    releaseDate?: Date | string | null;
    price?: number | null;
    averageRating?: number | null;
    reviewCount?: number | null;
    duration?: number | null;
    title?: string | null;
  },
  sortType: CursorSortType = 'releaseDate',
): CursorData {
  const id = typeof product['id'] === 'string' ? parseInt(product['id'], 10) : product['id'];

  // ソートタイプに応じたカーソルデータを生成
  const cursorData: CursorData = { type: sortType, id };

  switch (sortType) {
    case 'releaseDate': {
      let releaseDate: string | null = null;
      if (product['releaseDate']) {
        if (product['releaseDate'] instanceof Date) {
          releaseDate = product['releaseDate'].toISOString();
        } else {
          releaseDate = product['releaseDate'];
        }
      }
      cursorData.releaseDate = releaseDate;
      break;
    }
    case 'price':
      cursorData.price = product['price'] ?? null;
      break;
    case 'rating':
      cursorData.rating = product.averageRating ?? null;
      break;
    case 'reviewCount':
      cursorData.reviewCount = product['reviewCount'] ?? null;
      break;
    case 'duration':
      cursorData.duration = product['duration'] ?? null;
      break;
    case 'title':
      cursorData.title = product['title'] ?? null;
      break;
  }

  return cursorData;
}

/** カラム名マッピング */
const SORT_TYPE_TO_COLUMN: Record<CursorSortType, string> = {
  releaseDate: 'p.release_date',
  price: 'ps.price',
  rating: 'p.average_rating',
  reviewCount: 'p.review_count',
  duration: 'p.duration',
  title: 'p.title',
};

/**
 * カーソルベースのWHERE条件を生成（SQL用）
 *
 * releaseDateDesc（新しい順）の場合:
 * WHERE (release_date < cursor_date)
 *    OR (release_date = cursor_date AND id < cursor_id)
 *    OR (release_date IS NULL AND cursor_date IS NOT NULL)
 *    OR (release_date IS NULL AND cursor_date IS NULL AND id < cursor_id)
 *
 * @param cursor カーソルデータ
 * @param sortOrder ソート順序（'desc' | 'asc'）
 * @returns SQL条件文字列と値の配列
 */
export function buildCursorCondition(
  cursor: CursorData,
  sortOrder: 'desc' | 'asc' = 'desc',
): { condition: string; values: (string | number | null)[] } {
  const sortType = cursor.type || 'releaseDate';
  const column = SORT_TYPE_TO_COLUMN[sortType];
  const op = sortOrder === 'desc' ? '<' : '>';
  const { id } = cursor;

  // ソートタイプに応じた値を取得
  let sortValue: string | number | null;
  switch (sortType) {
    case 'releaseDate':
      sortValue = cursor.releaseDate ?? null;
      break;
    case 'price':
      sortValue = cursor.price ?? null;
      break;
    case 'rating':
      sortValue = cursor.rating ?? null;
      break;
    case 'reviewCount':
      sortValue = cursor.reviewCount ?? null;
      break;
    case 'duration':
      sortValue = cursor.duration ?? null;
      break;
    case 'title':
      sortValue = cursor.title ?? null;
      break;
    default:
      sortValue = null;
  }

  if (sortValue === null) {
    // カーソル値がnullの場合
    // NULLは最後に来るので、同じNULL内でidで比較
    return {
      condition: `(${column} IS NOT NULL OR (${column} IS NULL AND p.id ${op} $1))`,
      values: [id],
    };
  }

  // titleの場合は文字列比較（COLLATE対応）
  if (sortType === 'title') {
    return {
      condition: `(
        (${column} ${op} $1)
        OR (${column} = $1 AND p.id ${op} $2)
        OR (${column} IS NULL)
      )`,
      values: [sortValue, id],
    };
  }

  // 通常のケース（数値・日付）
  return {
    condition: `(
      (${column} ${op} $1)
      OR (${column} = $1 AND p.id ${op} $2)
      OR (${column} IS NULL)
    )`,
    values: [sortValue, id],
  };
}

/**
 * 結果リストから次のカーソルを生成
 * @param items 結果アイテム配列
 * @param limit 取得件数上限
 * @param sortType ソートタイプ（デフォルト: 'releaseDate'）
 * @returns 次のカーソル（なければnull）
 */
export function getNextCursor<
  T extends {
    id: number | string;
    releaseDate?: Date | string | null;
    price?: number | null;
    averageRating?: number | null;
    reviewCount?: number | null;
    duration?: number | null;
    title?: string | null;
  },
>(items: T[], limit: number, sortType: CursorSortType = 'releaseDate'): ProductCursor | null {
  if (items.length < limit) {
    // これ以上データがない
    return null;
  }

  const lastItem = items[items.length - 1];
  if (!lastItem) {
    return null;
  }

  const cursorData = createCursorFromProduct(lastItem, sortType);
  return encodeCursor(cursorData);
}

/**
 * ProductSortOptionからCursorSortTypeへの変換
 * @param sortOption ソートオプション
 * @returns カーソルソートタイプ
 */
export function sortOptionToCursorType(sortOption: string): CursorSortType {
  switch (sortOption) {
    case 'releaseDateDesc':
    case 'releaseDateAsc':
      return 'releaseDate';
    case 'priceDesc':
    case 'priceAsc':
      return 'price';
    case 'ratingDesc':
    case 'ratingAsc':
      return 'rating';
    case 'reviewCountDesc':
      return 'reviewCount';
    case 'durationDesc':
    case 'durationAsc':
      return 'duration';
    case 'titleAsc':
      return 'title';
    default:
      return 'releaseDate';
  }
}

/**
 * ProductSortOptionからソート順序を取得
 * @param sortOption ソートオプション
 * @returns 'desc' | 'asc'
 */
export function sortOptionToOrder(sortOption: string): 'desc' | 'asc' {
  if (sortOption.endsWith('Asc')) {
    return 'asc';
  }
  return 'desc';
}
