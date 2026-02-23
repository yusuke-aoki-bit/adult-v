/**
 * Web App (adult-v) - Database Queries
 * 共通ファクトリ (createAppQueries) を使用し、web固有のキャッシュラッパーを追加
 */
import { getDb } from './index';
import {
  products,
  performers,
  productPerformers,
  tags,
  productTags,
  productSources,
  performerAliases,
  productImages,
  productVideos,
  productSales,
  productRatingSummary,
} from './schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import type { Product as ProductType, Actress as ActressType } from '@/types/product';
import { mapLegacyProvider } from '@adult-v/shared/lib/provider-utils';
import { getDtiServiceFromUrl } from '@adult-v/shared/lib/image-utils';
import {
  getLocalizedTitle,
  getLocalizedDescription,
  getLocalizedPerformerName,
  getLocalizedPerformerBio,
  getLocalizedTagName,
  getLocalizedAiReview,
} from '@adult-v/shared/lib/localization';
import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import {
  generateProductIdVariations,
  buildAspNormalizationSql,
  normalizeAspName,
  getProviderLabel,
  isValidPerformerName,
  createAppQueries,
} from '@adult-v/shared';
import type {
  SaleProduct,
  CareerAnalysis,
  ActressSortOption,
  GetProductsOptions as SharedGetProductsOptions,
  ProductSortOption,
  GetActressesOptions as SharedGetActressesOptions,
  GetActressesCountOptions as SharedGetActressesCountOptions,
  UncategorizedProductsOptions,
  UncategorizedProductsCountOptions,
  CategoryWithCount,
  UncategorizedStats,
  SeriesProduct,
  PopularSeries,
  PopularMaker,
  MakerPreference,
  MakerInfo as SharedMakerInfo,
  SeriesBasicInfo,
} from '@adult-v/shared';
import type { RandomProduct, ProductSourceWithSales, SeriesInfo } from '@adult-v/shared/db-queries/create-app-queries';

// Re-export types
export type { SaleProduct, CareerAnalysis };
export type SortOption = ProductSortOption;
export type GetProductsOptions = SharedGetProductsOptions;
export type { ActressSortOption };
export type GetActressesOptions = SharedGetActressesOptions;
export type GetActressesCountOptions = SharedGetActressesCountOptions;
export type { SeriesBasicInfo, SeriesProduct };
export type MakerInfo = SharedMakerInfo;
export { CategoryWithCount, UncategorizedStats };
export type { RandomProduct, ProductSourceWithSales };
export interface SeriesInfoExtended extends SeriesInfo {
  products?: SeriesProduct[];
}

// 共通ファクトリでクエリを初期化
const appQueries = createAppQueries<ProductType, ActressType>({
  getDb,
  products,
  performers,
  productPerformers,
  performerAliases,
  tags,
  productTags,
  productSources,
  productImages,
  productVideos,
  productSales,
  productRatingSummary,
  siteMode: 'all',
  enableActressFeatureFilter: true,
  isValidPerformerName,
  getDtiServiceFromUrl,
  mapLegacyProvider,
  getProviderLabel,
  getLocalizedTitle,
  getLocalizedDescription,
  getLocalizedPerformerName,
  getLocalizedPerformerBio,
  getLocalizedTagName,
  getLocalizedAiReview: getLocalizedAiReview as any,
  generateProductIdVariations,
  buildAspNormalizationSql,
  normalizeAspName,
  unstable_cache,
});

// ============================================================
// 基本クエリ関数のエクスポート（キャッシュなし版はそのまま使用）
// ============================================================
export const {
  getProductById,
  searchProductByProductId,
  getProductsByActress,
  getTags,
  getTagsForActress,
  getPopularTags,
  getTagById,
  getActressById,
  getPerformerAliases,
  getActressProductCountBySite,
  getActressProductCountByAsp,
  getActressAvgPricePerMin,
  getActressCareerAnalysis,
  getActressBudgetSummary,
  getNewProducts,
  getFeaturedProducts,
  getFeaturedActresses,
  getProductSources,
  getProductSourcesWithSales,
  getProductSourcesByMakerCode,
  getProductSourcesByTitle,
  getSampleImagesByMakerCode,
  getProductMakerCode,
  getAllProductSources,
  fuzzySearchProducts,
  getActressesWithNewReleases,
  getRecentProducts,
  getUncategorizedProducts,
  getMultiAspActresses,
  getActressesByAsp,
  getProviderProductCounts,
  getAspStats,
  getCategories,
  getProductsByCategory,
  getProductCountByCategory,
  getAspStatsByCategory,
  getUncategorizedStats,
  getCandidatePerformers,
  getSaleStats,
  getRandomProduct,
  getSeriesByTagId,
  getSeriesInfo,
  getSeriesProducts,
  getPopularSeries,
  getMakerById,
  getPopularMakers,
  analyzeMakerPreference,
} = appQueries;

// ============================================================
// リクエスト単位の重複排除（React cache）
// generateMetadata + page で同じデータを二重取得するのを防止
// ============================================================

export const getCachedProductByIdOrCode = cache((id: string, locale: string): Promise<ProductType | null> => {
  return unstable_cache(
    async () => {
      let product = await appQueries.searchProductByProductId(id, locale);
      if (!product && !isNaN(parseInt(id))) {
        product = await appQueries.getProductById(id, locale);
      }
      return product;
    },
    [`product-detail-${id}-${locale}`],
    { revalidate: 300, tags: [`products-detail-${id}`] },
  )();
});

export const getCachedActressById = cache((id: string, locale: string): Promise<ActressType | null> => {
  return unstable_cache(
    async () => {
      const decoded = decodeURIComponent(id);
      let actress = await appQueries.getActressById(decoded, locale);
      if (!actress) actress = await appQueries.getActressById(id, locale);
      return actress;
    },
    [`actress-detail-${id}-${locale}`],
    { revalidate: 300, tags: [`actresses-detail-${id}`] },
  )();
});

// ============================================================
// Web固有: キャッシュラッパー付きオーバーライド
// ============================================================

/**
 * 商品一覧を取得（フィルターなし時はキャッシュ使用）
 */
function getCachedProductsList(offset: number, limit: number, sortBy: string, locale: string) {
  const cached = unstable_cache(
    () => appQueries._getProductsShared<ProductType>({ offset, limit, sortBy: sortBy as ProductSortOption, locale }),
    [`products-list-${offset}-${limit}-${sortBy}-${locale}`],
    { revalidate: 60, tags: ['products-list'] },
  );
  return cached();
}

export async function getProducts(options?: GetProductsOptions): Promise<ProductType[]> {
  const hasFilters =
    options &&
    (options.query ||
      options.providers?.length ||
      options.excludeProviders?.length ||
      options.tags?.length ||
      options.excludeTags?.length ||
      options.hasVideo ||
      options.hasImage ||
      options.onSale ||
      options.uncategorized ||
      options.performerType ||
      options.actressId ||
      options.isNew ||
      options.isFeatured ||
      options.releaseDate ||
      options.minPrice !== undefined ||
      options.maxPrice !== undefined);

  if (!hasFilters && options?.offset !== undefined && options?.limit !== undefined) {
    return getCachedProductsList(
      options.offset,
      options.limit,
      options.sortBy || 'releaseDateDesc',
      options.locale || 'ja',
    );
  }

  return appQueries.getProducts(options);
}

/**
 * 商品数を取得（フィルターなし時はキャッシュ使用）
 */
const getCachedTotalProductCount = unstable_cache(
  async () => appQueries._getProductsCountShared(),
  ['total-product-count'],
  { revalidate: 300 },
);

export async function getProductsCount(
  options?: Omit<GetProductsOptions, 'limit' | 'offset' | 'sortBy' | 'locale'>,
): Promise<number> {
  const hasFilters =
    options &&
    (options.query ||
      options.providers?.length ||
      options.excludeProviders?.length ||
      options.tags?.length ||
      options.excludeTags?.length ||
      options.hasVideo ||
      options.hasImage ||
      options.onSale ||
      options.uncategorized ||
      options.performerType ||
      options.actressId ||
      options.isNew ||
      options.isFeatured ||
      options.releaseDate ||
      options.minPrice !== undefined ||
      options.maxPrice !== undefined);

  if (!hasFilters) {
    return getCachedTotalProductCount();
  }

  return appQueries.getProductsCount(options);
}

/**
 * 女優一覧を取得（トップページ用キャッシュ付き）
 */
function getCachedTopActresses(limit: number, offset: number, locale: string) {
  const cached = unstable_cache(
    () => appQueries._getActressesShared<ActressType>({ limit, offset, sortBy: 'recent', locale }),
    [`actresses-top-${offset}-${limit}-${locale}`],
    { revalidate: 300, tags: ['actresses-list'] },
  );
  return cached();
}

export async function getActresses(options?: GetActressesOptions): Promise<ActressType[]> {
  const hasFilters =
    options &&
    (options.query ||
      options.includeTags?.length ||
      options.excludeTags?.length ||
      options.includeAsps?.length ||
      options.excludeAsps?.length ||
      options.hasVideo ||
      options.hasImage ||
      options.hasReview ||
      options.excludeInitials ||
      options.cupSizes?.length ||
      options.heightMin ||
      options.heightMax ||
      options.bloodTypes?.length);
  const sortBy = options?.sortBy || 'recent';
  const isDefaultSort = sortBy === 'recent';

  if (!hasFilters && isDefaultSort && options?.limit && options?.offset !== undefined) {
    return getCachedTopActresses(options.limit, options.offset, options.locale || 'ja');
  }

  return appQueries.getActresses(options);
}

/**
 * 女優数を取得（フィルターなし時はキャッシュ使用）
 */
const getCachedActressesCount = unstable_cache(() => appQueries._getActressesCountShared(), ['actresses-count-top'], {
  revalidate: 300,
  tags: ['actresses-count'],
});

export async function getActressesCount(options?: GetActressesCountOptions): Promise<number> {
  const hasFilters =
    options &&
    (options.query ||
      options.includeTags?.length ||
      options.excludeTags?.length ||
      options.includeAsps?.length ||
      options.excludeAsps?.length ||
      options.hasVideo ||
      options.hasImage ||
      options.hasReview ||
      options.excludeInitials ||
      options.cupSizes?.length ||
      options.heightMin ||
      options.heightMax ||
      options.bloodTypes?.length);

  if (!hasFilters) {
    return getCachedActressesCount();
  }

  return appQueries.getActressesCount(options);
}

/**
 * 未整理作品数を取得（オプションなし時はキャッシュ使用）
 */
const getCachedUncategorizedCount = unstable_cache(
  () => appQueries._getUncategorizedProductsCountShared(),
  ['uncategorized-count'],
  { revalidate: 300, tags: ['uncategorized-count'] },
);

export async function getUncategorizedProductsCount(options?: UncategorizedProductsCountOptions): Promise<number> {
  if (!options || Object.keys(options).length === 0) {
    return getCachedUncategorizedCount();
  }
  return appQueries.getUncategorizedProductsCount(options);
}

/**
 * セール商品を取得（シンプルリクエスト時はキャッシュ使用）
 */
const getCachedSaleProducts = unstable_cache(
  (limit: number) => appQueries._getSaleProductsShared({ limit }),
  ['sale-products-top'],
  { revalidate: 60, tags: ['sale-products'] },
);

export async function getSaleProducts(options?: {
  limit?: number;
  aspName?: string;
  minDiscount?: number;
}): Promise<SaleProduct[]> {
  if (!options?.aspName && !options?.minDiscount) {
    return getCachedSaleProducts(options?.limit || 20);
  }
  return appQueries.getSaleProducts(options);
}

// ============================================================
// Web固有: getTrendingActresses（fanzaにはない機能）
// ============================================================

/**
 * トレンドの女優を取得（最近作品がリリースされた人気女優）
 */
export async function getTrendingActresses(options?: { limit?: number }): Promise<
  Array<{
    id: number;
    name: string;
    thumbnailUrl: string | null;
    releaseCount?: number;
  }>
> {
  const { limit = 8 } = options || {};
  const db = getDb();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const results = await db
    .select({
      id: performers.id,
      name: performers.name,
      thumbnailUrl: performers.profileImageUrl,
      releaseCount: performers.releaseCount,
    })
    .from(performers)
    .where(
      and(
        sql`${performers.latestReleaseDate} >= ${thirtyDaysAgo.toISOString().split('T')[0]}`,
        sql`${performers.releaseCount} > 5`,
        sql`${performers.profileImageUrl} IS NOT NULL`,
      ),
    )
    .orderBy(desc(performers.releaseCount), desc(performers.latestReleaseDate))
    .limit(limit);

  return results.map((r) => ({
    id: r.id,
    name: r.name,
    thumbnailUrl: r.thumbnailUrl,
    releaseCount: r.releaseCount ?? undefined,
  }));
}
