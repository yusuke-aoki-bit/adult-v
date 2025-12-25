/**
 * 共有DBクエリ用型定義
 * Drizzle ORMのテーブル型を抽象化
 */
import type { SQL } from 'drizzle-orm';
import type { SiteMode } from './asp-filter';

// ============================================================
// テーブル列の型定義
// ============================================================

/**
 * 基本的なカラム型
 * Drizzle ORMの列定義を抽象化
 */
export interface Column<T = unknown> {
  _: {
    data: T;
    notNull: boolean;
  };
}

/**
 * Productsテーブルのカラム定義
 */
export interface ProductsTableColumns {
  id: Column<number>;
  normalizedProductId: Column<string>;
  makerProductCode: Column<string | null>;
  title: Column<string>;
  releaseDate: Column<string | null>;
  description: Column<string | null>;
  duration: Column<number | null>;
  defaultThumbnailUrl: Column<string | null>;
  titleEn: Column<string | null>;
  titleZh: Column<string | null>;
  titleZhTw: Column<string | null>;
  titleKo: Column<string | null>;
  descriptionEn: Column<string | null>;
  descriptionZh: Column<string | null>;
  descriptionZhTw: Column<string | null>;
  descriptionKo: Column<string | null>;
  aiDescription: Column<unknown>;
  aiCatchphrase: Column<string | null>;
  aiShortDescription: Column<string | null>;
  aiTags: Column<unknown>;
  aiReview: Column<string | null>;
  aiReviewUpdatedAt: Column<Date | null>;
  createdAt: Column<Date>;
  updatedAt: Column<Date>;
}

/**
 * ProductSourcesテーブルのカラム定義
 */
export interface ProductSourcesTableColumns {
  id: Column<number>;
  productId: Column<number>;
  aspName: Column<string>;
  originalProductId: Column<string>;
  affiliateUrl: Column<string>;
  price: Column<number | null>;
  currency: Column<string | null>;
  isSubscription: Column<boolean>;
  dataSource: Column<string>;
  lastUpdated: Column<Date | null>;
}

/**
 * PerformersテーブルのカラムDefinition
 */
export interface PerformersTableColumns {
  id: Column<number>;
  name: Column<string>;
  nameKana: Column<string | null>;
  nameEn: Column<string | null>;
  nameZh: Column<string | null>;
  nameKo: Column<string | null>;
  bust: Column<number | null>;
  waist: Column<number | null>;
  hip: Column<number | null>;
  height: Column<number | null>;
  birthDate: Column<string | null>;
  birthYear: Column<number | null>;
  bloodType: Column<string | null>;
  profileImageUrl: Column<string | null>;
  isFanzaOnly: Column<boolean>;
  createdAt: Column<Date>;
  updatedAt: Column<Date>;
}

/**
 * TagsテーブルのカラムDefinition
 */
export interface TagsTableColumns {
  id: Column<number>;
  name: Column<string>;
  category: Column<string | null>;
  createdAt: Column<Date>;
}

/**
 * ProductPerformersテーブルのカラム定義
 */
export interface ProductPerformersTableColumns {
  productId: Column<number>;
  performerId: Column<number>;
}

/**
 * ProductTagsテーブルのカラム定義
 */
export interface ProductTagsTableColumns {
  productId: Column<number>;
  tagId: Column<number>;
}

/**
 * ProductImagesテーブルのカラム定義
 */
export interface ProductImagesTableColumns {
  id: Column<number>;
  productId: Column<number>;
  imageUrl: Column<string>;
  displayOrder: Column<number>;
  source: Column<string | null>;
}

/**
 * ProductVideosテーブルのカラム定義
 */
export interface ProductVideosTableColumns {
  id: Column<number>;
  productId: Column<number>;
  videoUrl: Column<string>;
  videoType: Column<string | null>;
}

/**
 * ProductSalesテーブルのカラム定義
 */
export interface ProductSalesTableColumns {
  id: Column<number>;
  productSourceId: Column<number>;
  regularPrice: Column<number>;
  salePrice: Column<number>;
  discountPercent: Column<number>;
  startAt: Column<Date | null>;
  endAt: Column<Date | null>;
  saleName: Column<string | null>;
  saleType: Column<string | null>;
  isActive: Column<boolean>;
}

// ============================================================
// テーブル参照型（anyの代替）
// ============================================================

/**
 * Drizzle ORMテーブル参照の基本型
 * eslint-disable-next-line @typescript-eslint/no-explicit-any を避けるため
 */
export type TableReference = {
  [key: string]: Column;
};

/**
 * Products テーブル参照型
 */
export type ProductsTable = TableReference & ProductsTableColumns;

/**
 * ProductSources テーブル参照型
 */
export type ProductSourcesTable = TableReference & ProductSourcesTableColumns;

/**
 * Performers テーブル参照型
 */
export type PerformersTable = TableReference & PerformersTableColumns;

/**
 * Tags テーブル参照型
 */
export type TagsTable = TableReference & TagsTableColumns;

/**
 * ProductPerformers テーブル参照型
 */
export type ProductPerformersTable = TableReference & ProductPerformersTableColumns;

/**
 * ProductTags テーブル参照型
 */
export type ProductTagsTable = TableReference & ProductTagsTableColumns;

/**
 * ProductImages テーブル参照型
 */
export type ProductImagesTable = TableReference & ProductImagesTableColumns;

/**
 * ProductVideos テーブル参照型
 */
export type ProductVideosTable = TableReference & ProductVideosTableColumns;

/**
 * ProductSales テーブル参照型
 */
export type ProductSalesTable = TableReference & ProductSalesTableColumns;

// ============================================================
// DB接続型
// ============================================================

/**
 * DB接続の基本型
 */
export interface DbConnection {
  select: () => SelectBuilder;
  execute: (query: SQL) => Promise<{ rows: unknown[] }>;
}

/**
 * Select クエリビルダー
 */
export interface SelectBuilder {
  from: (table: TableReference) => FromBuilder;
}

/**
 * From句ビルダー
 */
export interface FromBuilder {
  where: (condition: SQL | undefined) => WhereBuilder;
  innerJoin: (table: TableReference, condition: SQL) => FromBuilder;
  leftJoin: (table: TableReference, condition: SQL) => FromBuilder;
  orderBy: (...columns: SQL[]) => FromBuilder;
  limit: (n: number) => Promise<unknown[]>;
}

/**
 * Where句ビルダー
 */
export interface WhereBuilder {
  orderBy: (...columns: SQL[]) => WhereBuilder;
  limit: (n: number) => Promise<unknown[]>;
  groupBy: (...columns: Column[]) => GroupByBuilder;
}

/**
 * GroupBy句ビルダー
 */
export interface GroupByBuilder {
  orderBy: (...columns: SQL[]) => GroupByBuilder;
  limit: (n: number) => Promise<unknown[]>;
}

// ============================================================
// 共通結果型
// ============================================================

/**
 * ページネーション結果
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * ページネーションオプション
 */
export interface PaginationOptions {
  page?: number;
  pageSize?: number;
  limit?: number;
  offset?: number;
}

/**
 * ソートオプション
 */
export interface SortOptions {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * フィルターオプション
 */
export interface FilterOptions {
  search?: string;
  category?: string;
  provider?: string;
  startDate?: string;
  endDate?: string;
}

// ============================================================
// サイトモード関連型
// ============================================================

// Note: SiteModeはasp-filter.tsで定義（'all' | 'fanza-only'）

/**
 * ソースデータ型
 * productSourcesテーブルから取得するデータの型
 */
export interface SourceData {
  aspName: string;
  affiliateUrl: string | null;
  price: number | null;
  originalProductId?: string;
  currency?: string | null;
  isSubscription?: boolean;
}

/**
 * 演者データ型
 * performersテーブルから取得するデータの型
 */
export interface PerformerData {
  id: number;
  name: string;
  nameKana?: string | null;
  nameEn?: string | null;
}

/**
 * タグデータ型
 * tagsテーブルから取得するデータの型
 */
export interface TagData {
  id: number;
  name: string;
  category: string | null;
  nameEn?: string | null;
}

/**
 * バッチ取得用キャッシュデータ
 * 一括取得した関連データを保持
 */
export interface CacheData {
  sources: Map<number, SourceData[]>;
  performers: Map<number, PerformerData[]>;
  tags: Map<number, TagData[]>;
}

/**
 * 生の商品行データ型
 * DBから直接取得した行データ
 */
export interface RawProductRow {
  id: number;
  normalized_product_id: string;
  title: string;
  release_date: string | null;
  description: string | null;
  duration: number | null;
  default_thumbnail_url: string | null;
  title_en?: string | null;
  title_zh?: string | null;
  title_zh_tw?: string | null;
  title_ko?: string | null;
  description_en?: string | null;
  description_zh?: string | null;
  description_zh_tw?: string | null;
  description_ko?: string | null;
  ai_description?: unknown;
  ai_catchphrase?: string | null;
  ai_short_description?: string | null;
  ai_tags?: unknown;
  ai_review?: string | null;
  ai_review_updated_at?: Date | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * FANZAフィルタ設定
 */
export interface FanzaFilterConfig {
  /** サイトモード */
  mode: SiteMode;
  /** 優先プロバイダー（ソース選択時に優先） */
  preferredProviders?: string[];
  /** 除外プロバイダー */
  excludeProviders?: string[];
}

/**
 * 商品クエリオプション（共通）
 */
export interface ProductQueryOptions extends PaginationOptions, SortOptions {
  /** 検索キーワード */
  search?: string;
  /** プロバイダーフィルタ */
  providers?: string[];
  /** 除外プロバイダー */
  excludeProviders?: string[];
  /** 女優ID */
  actressId?: string;
  /** タグID */
  tagId?: number;
  /** カテゴリ */
  category?: string;
  /** 最低価格 */
  minPrice?: number;
  /** 最高価格 */
  maxPrice?: number;
  /** サンプル動画ありのみ */
  hasVideo?: boolean;
  /** サンプル画像ありのみ */
  hasImage?: boolean;
  /** セール中のみ */
  onSale?: boolean;
  /** 出演形態フィルタ */
  performerType?: 'solo' | 'multi' | 'all';
  /** ロケール */
  locale?: string;
  /** 未整理作品のみ */
  uncategorized?: boolean;
}
