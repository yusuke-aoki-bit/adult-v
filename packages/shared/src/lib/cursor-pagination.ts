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

    // バリデーション
    if (typeof data.id !== 'number') {
      return null;
    }
    if (data.releaseDate !== null && typeof data.releaseDate !== 'string') {
      return null;
    }

    return {
      releaseDate: data.releaseDate ?? null,
      id: data.id,
    };
  } catch {
    return null;
  }
}

/**
 * 商品からカーソルデータを生成
 * @param product 商品オブジェクト（id, releaseDateを持つ）
 * @returns カーソルデータ
 */
export function createCursorFromProduct(product: {
  id: number | string;
  releaseDate?: Date | string | null;
}): CursorData {
  let releaseDate: string | null = null;

  if (product.releaseDate) {
    if (product.releaseDate instanceof Date) {
      releaseDate = product.releaseDate.toISOString();
    } else {
      releaseDate = product.releaseDate;
    }
  }

  return {
    releaseDate,
    id: typeof product.id === 'string' ? parseInt(product.id, 10) : product.id,
  };
}

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
  sortOrder: 'desc' | 'asc' = 'desc'
): { condition: string; values: (string | number | null)[] } {
  const { releaseDate, id } = cursor;
  const op = sortOrder === 'desc' ? '<' : '>';
  const nullOp = sortOrder === 'desc' ? 'IS NULL' : 'IS NOT NULL';

  if (releaseDate === null) {
    // カーソルのreleaseDateがnullの場合
    // NULLは最後に来るので、同じNULL内でidで比較
    return {
      condition: `(p.release_date IS NOT NULL OR (p.release_date IS NULL AND p.id ${op} $1))`,
      values: [id],
    };
  }

  // 通常のケース
  return {
    condition: `(
      (p.release_date ${op} $1)
      OR (p.release_date = $1 AND p.id ${op} $2)
      OR (p.release_date IS NULL)
    )`,
    values: [releaseDate, id],
  };
}

/**
 * 結果リストから次のカーソルを生成
 * @param items 結果アイテム配列
 * @param limit 取得件数上限
 * @returns 次のカーソル（なければnull）
 */
export function getNextCursor<T extends { id: number | string; releaseDate?: Date | string | null }>(
  items: T[],
  limit: number
): ProductCursor | null {
  if (items.length < limit) {
    // これ以上データがない
    return null;
  }

  const lastItem = items[items.length - 1];
  if (!lastItem) {
    return null;
  }

  const cursorData = createCursorFromProduct(lastItem);
  return encodeCursor(cursorData);
}
