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
  return hasProperty(row, 'performerId') && isNumber(row.performerId);
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
    .map((row) => row.performerId);
}

/**
 * id を含む行の型ガード
 */
export function hasId(row: unknown): row is { id: number } {
  return hasProperty(row, 'id') && isNumber(row.id);
}

/**
 * idを持つ行の配列から、idの配列を抽出
 * 型安全にfilter + mapを1ステップで行う
 */
export function extractIds(rows: { id: unknown }[]): number[] {
  return rows.filter(hasId).map((row) => row.id);
}

/**
 * productId を含む行の型ガード
 */
export function hasProductId(
  row: unknown
): row is { productId: number } {
  return hasProperty(row, 'productId') && isNumber(row.productId);
}

/**
 * productIdを持つ行の配列から、productIdの配列を抽出
 * 型安全にfilter + mapを1ステップで行う
 */
export function extractProductIds(
  rows: { productId: unknown }[]
): number[] {
  return rows.filter(hasProductId).map((row) => row.productId);
}

/**
 * count を含む行の型ガード（文字列または数値）
 */
export function hasCount(
  row: unknown
): row is { count: string | number } {
  if (!hasProperty(row, 'count')) return false;
  return isString(row.count) || isNumber(row.count);
}

/**
 * aspName を含む行の型ガード
 */
export function hasAspName(row: unknown): row is { aspName: string } {
  return hasProperty(row, 'aspName') && isString(row.aspName);
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
