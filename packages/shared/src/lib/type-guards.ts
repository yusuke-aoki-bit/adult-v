/**
 * 型ガードユーティリティ
 * asキャストを減らし、型安全性を向上
 */

/**
 * 値がnullまたはundefinedでないことを確認
 */
export function isNotNullish<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * 値が文字列であることを確認
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * 値が数値であることを確認
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * 値が正の整数であることを確認
 */
export function isPositiveInteger(value: unknown): value is number {
  return isNumber(value) && Number.isInteger(value) && value > 0;
}

/**
 * 値がオブジェクトであることを確認（nullを除く）
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 値が配列であることを確認
 */
export function isArray<T = unknown>(value: unknown): value is T[] {
  return Array.isArray(value);
}

/**
 * オブジェクトが特定のキーを持つことを確認
 */
export function hasProperty<K extends string>(
  obj: unknown,
  key: K
): obj is Record<K, unknown> {
  return isObject(obj) && key in obj;
}

/**
 * DBクエリ結果の行が特定の構造を持つことを確認
 */
export function isDbRow<T extends Record<string, unknown>>(
  row: unknown,
  requiredKeys: (keyof T)[]
): row is T {
  if (!isObject(row)) return false;
  return requiredKeys.every((key) => key in row);
}

/**
 * performerId を含む行の型ガード
 */
export function hasPerformerId(
  row: unknown
): row is { performerId: number } {
  return hasProperty(row, 'performerId') && isNumber(row['performerId']);
}

/**
 * performerIdを持つ行の配列から、performerIdの配列を抽出
 * 型安全にfilter + mapを1ステップで行う
 */
export function extractPerformerIds(
  rows: { performerId: unknown }[]
): number[] {
  return rows
    .filter(hasPerformerId)
    .map((row) => row['performerId']);
}

/**
 * id を含む行の型ガード
 */
export function hasId(row: unknown): row is { id: number } {
  return hasProperty(row, 'id') && isNumber(row['id']);
}

/**
 * idを持つ行の配列から、idの配列を抽出
 * 型安全にfilter + mapを1ステップで行う
 */
export function extractIds(rows: { id: unknown }[]): number[] {
  return rows.filter(hasId).map((row) => row['id']);
}

/**
 * productId を含む行の型ガード
 */
export function hasProductId(
  row: unknown
): row is { productId: number } {
  return hasProperty(row, 'productId') && isNumber(row['productId']);
}

/**
 * productIdを持つ行の配列から、productIdの配列を抽出
 * 型安全にfilter + mapを1ステップで行う
 */
export function extractProductIds(
  rows: { productId: unknown }[]
): number[] {
  return rows.filter(hasProductId).map((row) => row['productId']);
}

/**
 * count を含む行の型ガード（文字列または数値）
 */
export function hasCount(
  row: unknown
): row is { count: string | number } {
  if (!hasProperty(row, 'count')) return false;
  return isString(row['count']) || isNumber(row['count']);
}

/**
 * aspName を含む行の型ガード
 */
export function hasAspName(row: unknown): row is { aspName: string } {
  return hasProperty(row, 'aspName') && isString(row['aspName']);
}

/**
 * 配列の各要素をフィルタリングしながら型を絞り込む
 */
export function filterMap<T, U>(
  array: T[],
  predicate: (item: T) => item is T & U
): (T & U)[] {
  return array.filter(predicate);
}

/**
 * nullish値を除外した配列を返す
 */
export function compact<T>(array: (T | null | undefined)[]): T[] {
  return array.filter(isNotNullish);
}

/**
 * 安全にnumber型に変換（失敗時はundefined）
 */
export function toNumber(value: unknown): number | undefined {
  if (isNumber(value)) return value;
  if (isString(value)) {
    const parsed = parseFloat(value);
    if (!isNaN(parsed)) return parsed;
  }
  return undefined;
}

/**
 * 安全にstring型に変換（失敗時はundefined）
 */
export function toString(value: unknown): string | undefined {
  if (isString(value)) return value;
  if (value === null || value === undefined) return undefined;
  return String(value);
}

// ============================================================
// DB行データ抽出用型ガード
// ============================================================

/**
 * DB行から安全にnumber値を抽出
 */
export function getNumberField(row: Record<string, unknown>, key: string): number | undefined {
  const value = row[key];
  return isNumber(value) ? value : undefined;
}

/**
 * DB行から安全にstring値を抽出
 */
export function getStringField(row: Record<string, unknown>, key: string): string | undefined {
  const value = row[key];
  return isString(value) ? value : undefined;
}

/**
 * DB行から安全にDate値を抽出
 */
export function getDateField(row: Record<string, unknown>, key: string): Date | undefined {
  const value = row[key];
  if (value instanceof Date) return value;
  if (isString(value)) {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return undefined;
}

/**
 * DB行から安全にboolean値を抽出
 */
export function getBooleanField(row: Record<string, unknown>, key: string): boolean | undefined {
  const value = row[key];
  if (typeof value === 'boolean') return value;
  return undefined;
}

/**
 * DB行から安全にstring[]値を抽出
 */
export function getStringArrayField(row: Record<string, unknown>, key: string): string[] | undefined {
  const value = row[key];
  if (isArray(value) && value.every(isString)) return value;
  return undefined;
}

// ============================================================
// DBクエリ結果用の型変換ヘルパー
// DIパターンで型情報が失われる場合に使用
// ============================================================

/**
 * Performer行データの型
 */
export interface PerformerRow {
  id: number;
  name: string;
  nameKana: string | null;
}

/**
 * Tag行データの型
 */
export interface TagRow {
  id: number;
  name: string;
  category: string | null;
}

/**
 * ProductSource行データの型
 */
export interface SourceRow {
  aspName: string | undefined;
  originalProductId: string | undefined;
  affiliateUrl: string | undefined;
  price: number | undefined;
  currency: string | undefined;
}

/**
 * ProductImage行データの型
 */
export interface ImageRow {
  productId: number;
  imageUrl: string;
  imageType: string;
  displayOrder: number | null;
}

/**
 * ProductVideo行データの型
 */
export interface VideoRow {
  productId: number;
  videoUrl: string;
  videoType: string | null;
  quality: string | null;
  duration: number | null;
}

/**
 * 未知の配列をPerformerRow[]に型安全に変換
 */
export function toPerformerRows(rows: unknown[]): PerformerRow[] {
  return rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: (r['id'] as number) ?? 0,
      name: (r['name'] as string) ?? '',
      nameKana: (r['nameKana'] as string | null) ?? null,
    };
  });
}

/**
 * 未知の配列をTagRow[]に型安全に変換
 */
export function toTagRows(rows: unknown[]): TagRow[] {
  return rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: (r['id'] as number) ?? 0,
      name: (r['name'] as string) ?? '',
      category: (r['category'] as string | null) ?? null,
    };
  });
}

/**
 * 未知の値をSourceRow | undefinedに型安全に変換
 */
export function toSourceRow(row: unknown): SourceRow | undefined {
  if (!row) return undefined;
  const r = row as Record<string, unknown>;
  return {
    aspName: r['aspName'] as string | undefined,
    originalProductId: r['originalProductId'] as string | undefined,
    affiliateUrl: r['affiliateUrl'] as string | undefined,
    price: r['price'] as number | undefined,
    currency: r['currency'] as string | undefined,
  };
}

/**
 * 未知の配列をImageRow[]に型安全に変換
 */
export function toImageRows(rows: unknown[]): ImageRow[] {
  return rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      productId: (r['productId'] as number) ?? 0,
      imageUrl: (r['imageUrl'] as string) ?? '',
      imageType: (r['imageType'] as string) ?? '',
      displayOrder: (r['displayOrder'] as number | null) ?? null,
    };
  });
}

/**
 * 未知の配列をVideoRow[]に型安全に変換
 */
export function toVideoRows(rows: unknown[]): VideoRow[] {
  return rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      productId: (r['productId'] as number) ?? 0,
      videoUrl: (r['videoUrl'] as string) ?? '',
      videoType: (r['videoType'] as string | null) ?? null,
      quality: (r['quality'] as string | null) ?? null,
      duration: (r['duration'] as number | null) ?? null,
    };
  });
}

// ============================================================
// バッチクエリ結果用の型変換（スネーク/キャメルケース両対応）
// db.executeはスネークケース、通常クエリはキャメルケースを返す
// ============================================================

/**
 * BatchSource行データの型
 */
export interface BatchSourceRow {
  id: number;
  productId: number;
  aspName: string;
  originalProductId: string | null;
  affiliateUrl: string | null;
  price: number | null;
  currency: string | null;
  productType: string | null;
}

/**
 * 未知の配列をBatchSourceRow[]に型安全に変換
 */
export function toBatchSourceRows(rows: unknown[]): BatchSourceRow[] {
  return rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: ((r['id'] ?? 0) as number),
      productId: ((r['product_id'] ?? r['productId'] ?? 0) as number),
      aspName: ((r['asp_name'] ?? r['aspName'] ?? '') as string),
      originalProductId: ((r['original_product_id'] ?? r['originalProductId'] ?? null) as string | null),
      affiliateUrl: ((r['affiliate_url'] ?? r['affiliateUrl'] ?? null) as string | null),
      price: ((r['price'] ?? null) as number | null),
      currency: ((r['currency'] ?? null) as string | null),
      productType: ((r['product_type'] ?? r['productType'] ?? null) as string | null),
    };
  });
}

/**
 * BatchImage行データの型
 */
export interface BatchImageRow {
  productId: number;
  imageUrl: string;
  imageType: string;
  displayOrder: number | null;
}

/**
 * 未知の配列をBatchImageRow[]に型安全に変換（スネーク/キャメルケース両対応）
 */
export function toBatchImageRows(rows: unknown[]): BatchImageRow[] {
  return rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      productId: ((r['product_id'] ?? r['productId'] ?? 0) as number),
      imageUrl: ((r['image_url'] ?? r['imageUrl'] ?? '') as string),
      imageType: ((r['image_type'] ?? r['imageType'] ?? '') as string),
      displayOrder: ((r['display_order'] ?? r['displayOrder'] ?? null) as number | null),
    };
  });
}

/**
 * BatchVideo行データの型
 */
export interface BatchVideoRow {
  productId: number;
  videoUrl: string;
  videoType: string | null;
  quality: string | null;
  duration: number | null;
}

/**
 * 未知の配列をBatchVideoRow[]に型安全に変換（スネーク/キャメルケース両対応）
 */
export function toBatchVideoRows(rows: unknown[]): BatchVideoRow[] {
  return rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      productId: ((r['product_id'] ?? r['productId'] ?? 0) as number),
      videoUrl: ((r['video_url'] ?? r['videoUrl'] ?? '') as string),
      videoType: ((r['video_type'] ?? r['videoType'] ?? null) as string | null),
      quality: ((r['quality'] ?? null) as string | null),
      duration: ((r['duration'] ?? null) as number | null),
    };
  });
}

/**
 * BatchSale行データの型
 */
export interface BatchSaleRow {
  productId: number;
  regularPrice: number;
  salePrice: number;
  discountPercent: number | null;
  endAt: Date | null;
}

/**
 * 未知の配列をBatchSaleRow[]に型安全に変換
 */
export function toBatchSaleRows(rows: unknown[]): BatchSaleRow[] {
  return rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      productId: ((r['product_id'] ?? r['productId'] ?? 0) as number),
      regularPrice: ((r['regular_price'] ?? r['regularPrice'] ?? 0) as number),
      salePrice: ((r['sale_price'] ?? r['salePrice'] ?? 0) as number),
      discountPercent: ((r['discount_percent'] ?? r['discountPercent'] ?? null) as number | null),
      endAt: ((r['end_at'] ?? r['endAt'] ?? null) as Date | null),
    };
  });
}

/**
 * db.executeの結果（rows配列を持つ）か通常の配列かを判定して配列を取得
 */
export function extractRowsArray(result: unknown): unknown[] {
  if (Array.isArray(result)) {
    return result;
  }
  if (isObject(result) && 'rows' in result && Array.isArray(result['rows'])) {
    return result['rows'];
  }
  return [];
}
