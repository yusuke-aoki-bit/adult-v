/**
 * クローラー共通型定義
 */

// ============================================================
// Crawl Statistics
// ============================================================

/**
 * クロール統計の基本型
 */
export interface BaseCrawlStats {
  totalFetched: number;
  newProducts: number;
  updatedProducts: number;
  errors: number;
  rawDataSaved: number;
}

/**
 * 拡張クロール統計（レビュー、AI、セール対応）
 */
export interface ExtendedCrawlStats extends BaseCrawlStats {
  reviewsFetched?: number;
  reviewsSaved?: number;
  aiGenerated?: number;
  salesSaved?: number;
  videosAdded?: number;
}

// ============================================================
// Database Query Result Types
// ============================================================

/**
 * 基本的なDB行（IDのみ）
 */
export interface IdRow {
  id: number;
}

/**
 * 商品行（INSERT/UPDATE結果用）
 */
export interface ProductRow extends IdRow {
  normalized_product_id?: string;
  title?: string;
}

/**
 * 生データ行
 */
export interface RawDataRow extends IdRow {
  hash?: string;
  raw_json_text?: string;
  processed_at?: Date | null;
}

/**
 * 出演者行
 */
export interface PerformerRow extends IdRow {
  name: string;
  name_kana?: string;
}

/**
 * タグ/カテゴリ行
 */
export interface TagRow extends IdRow {
  name: string;
  category?: string;
}

/**
 * DB実行結果からtyped行を取得するヘルパー
 */
export function getFirstRow<T>(result: { rows: unknown[] }): T | null {
  return (result.rows.length > 0 ? result.rows[0] : null) as T | null;
}

/**
 * DB実行結果から全行をtypedで取得
 */
export function getRows<T>(result: { rows: unknown[] }): T[] {
  return result.rows as T[];
}

// ============================================================
// Parsed Product Data
// ============================================================

/**
 * パース済み商品データ（クローラー間で共通）
 */
export interface ParsedProductData {
  title?: string;
  description?: string;
  actors?: string[];
  releaseDate?: string;
  imageUrl?: string;
  sampleImages?: string[];
  sampleVideoUrl?: string;
  price?: number;
  originalPrice?: number;
  discountPercent?: number;
  duration?: number;
  maker?: string;
  label?: string;
  series?: string;
  genres?: string[];
}

// ============================================================
// Site Configuration
// ============================================================

/**
 * DTIサイト設定
 */
export interface DTISiteConfig {
  siteName: string;
  siteId: string;
  baseUrl: string;
  urlPattern: string;
  idFormat: 'MMDDYY_NNN' | 'MMDDYY_NNNN' | 'NNNN';
  startId?: string;
  endId?: string;
  maxConcurrent?: number;
  reverseMode?: boolean;
  jsonApiUrl?: string;
}

/**
 * クロールオプション
 */
export interface CrawlOptions {
  limit?: number;
  offset?: number;
  enableAI?: boolean;
  startId?: string;
  skipReviews?: boolean;
}

/**
 * クロール結果
 */
export interface CrawlResult {
  success: boolean;
  stats: ExtendedCrawlStats;
  errors?: string[];
  lastProcessedId?: string;
}
