/**
 * createAppQueries - Both apps (web/fanza) share ~95% identical query wrapper code.
 * This factory consolidates all common initialization and query functions into a
 * single reusable factory, allowing each app to just call createAppQueries() with
 * its own dependencies and then overlay any app-specific caching on top.
 */

import { eq, and, desc, asc, sql, inArray } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import {
  createBatchPerformerQueries,
  createCoreQueries,
  createSaleQueries,
  createActressQueries,
  createProductListQueries,
  createActressListQueries,
  createUncategorizedQueries,
  createProductQueries,
} from './index';
import {
  mapPerformerToActressTypeSync as mapPerformerToActressTypeSyncBase,
  mapProductToType as mapProductToTypeBase,
} from './mappers';
import type { ProductMapperDeps, SourceData } from './mappers';
import { getFromMemoryCache, setToMemoryCache, CACHE_REVALIDATE_SECONDS } from '../lib/cache-utils';
import type { GetProductsOptions as SharedGetProductsOptions, ProductSortOption } from './types';
import type {
  BatchRelatedDataResult,
  CategoryWithCount,
  UncategorizedStats,
  SeriesInfo as SharedSeriesInfo,
  SeriesProduct,
  PopularSeries,
  PopularMaker,
  MakerPreference,
  MakerInfo as SharedMakerInfo,
} from './core-queries';
import type { UncategorizedProductsOptions, UncategorizedProductsCountOptions } from './uncategorized-queries';
import type { SaleProduct } from './sale-helper';
import type { CareerAnalysis } from './actress-queries';
import type {
  ActressSortOption,
  GetActressesOptions as SharedGetActressesOptions,
  GetActressesCountOptions as SharedGetActressesCountOptions,
} from './actress-list-queries';

// ============================================================
// Exported Types
// ============================================================

/**
 * CacheData - local cache/stats data shape used by mappers
 */
export interface CacheData {
  viewCount?: number;
  clickCount?: number;
  favoriteCount?: number;
  price?: number;
  thumbnailUrl?: string;
  affiliateUrl?: string;
  sampleImages?: string[];
}

/**
 * RandomProduct type
 */
export interface RandomProduct {
  id: number;
  title: string;
  imageUrl: string;
  sampleImages: string[] | null;
  releaseDate: string | null;
  duration: number | null;
  price: number | null;
  provider: string | null;
}

/**
 * ProductSourceWithSales type
 */
export type ProductSourceWithSales = {
  aspName: string;
  originalProductId: string | null;
  regularPrice: number | null;
  salePrice: number | null;
  discountPercent: number | null;
  saleEndAt: Date | null;
  currency: string | null;
  affiliateUrl: string;
  isSubscription: boolean | null;
  productType: string | null;
  isOnSale: boolean;
};

/**
 * SeriesInfo - extended with optional products
 */
export interface SeriesInfo extends SharedSeriesInfo {
  products?: SeriesProduct[];
}

// Re-export type aliases used by consumers
export type SortOption = ProductSortOption;
export type GetProductsOptions = SharedGetProductsOptions;
export type GetActressesOptions = SharedGetActressesOptions;
export type GetActressesCountOptions = SharedGetActressesCountOptions;
export type { ActressSortOption, SaleProduct, CareerAnalysis };
export type { CategoryWithCount, UncategorizedStats };
export type { SeriesProduct, PopularSeries, PopularMaker, MakerPreference };
export type MakerInfo = SharedMakerInfo;

// ============================================================
// Dependencies Interface
// ============================================================

/**
 * All dependencies required by createAppQueries.
 * Each app provides its own concrete implementations.
 */
export interface CreateAppQueriesDeps {
  // DB access
  getDb: () => any;

  // Schema tables (drizzle table references)
  products: any;
  performers: any;
  productPerformers: any;
  performerAliases: any;
  tags: any;
  productTags: any;
  productSources: any;
  productImages: any;
  productVideos: any;
  productSales: any;
  productRatingSummary: any;

  // Site configuration
  siteMode: 'all' | 'fanza-only';
  enableActressFeatureFilter?: boolean;

  // Utility functions
  isValidPerformerName: (name: string) => boolean;
  getDtiServiceFromUrl: (url: string) => string | null;
  mapLegacyProvider: (provider: string) => string;
  getProviderLabel: (id: string) => string;
  getLocalizedTitle: (...args: any[]) => string;
  getLocalizedDescription: (...args: any[]) => string;
  getLocalizedPerformerName: (...args: any[]) => string;
  getLocalizedPerformerBio: (...args: any[]) => string;
  getLocalizedTagName: (...args: any[]) => string;
  getLocalizedAiReview: (...args: any[]) => string;

  // Shared functions
  generateProductIdVariations: (id: string) => string[];
  buildAspNormalizationSql: (col1: string, col2: string) => string;
  normalizeAspName: (name: string) => string;

  // Next.js cache (passed as dep since it's framework-specific)
  unstable_cache: (
    fn: (...args: any[]) => Promise<any>,
    keyParts?: string[],
    options?: { revalidate?: number | false; tags?: string[] },
  ) => (...args: any[]) => Promise<any>;
}

// ============================================================
// Return type of the factory
// ============================================================

export interface AppQueries<TProduct, TActress> {
  // Product by ID
  getProductById: (id: string, locale?: string) => Promise<TProduct | null>;
  searchProductByProductId: (productId: string, locale?: string) => Promise<TProduct | null>;

  // Product lists (base - no extra caching)
  getProducts: (options?: GetProductsOptions) => Promise<TProduct[]>;
  getProductsCount: (options?: Omit<GetProductsOptions, 'limit' | 'offset' | 'sortBy' | 'locale'>) => Promise<number>;
  getProductsByActress: (actressId: string, locale?: string) => Promise<TProduct[]>;

  // Actress lists (base - no extra caching)
  getActresses: (options?: GetActressesOptions) => Promise<TActress[]>;
  getActressesCount: (options?: GetActressesCountOptions) => Promise<number>;

  // Tags
  getTags: (category?: string) => Promise<Array<{ id: number; name: string; category: string | null }>>;
  getTagsForActress: (
    actressId: string,
    category?: string,
  ) => Promise<Array<{ id: number; name: string; category: string | null }>>;
  getPopularTags: (options?: {
    category?: string;
    limit?: number;
  }) => Promise<Array<{ id: number; name: string; category: string | null; count: number }>>;
  getTagById: (tagId: number) => Promise<{
    id: number;
    name: string;
    nameEn: string | null;
    nameZh: string | null;
    nameKo: string | null;
    category: string | null;
  } | null>;

  // Actress detail
  getActressById: (id: string, locale?: string) => Promise<TActress | null>;
  getPerformerAliases: (
    performerId: number,
  ) => Promise<
    Array<{ id: number; aliasName: string; source: string | null; isPrimary: boolean | null; createdAt: Date }>
  >;
  getActressProductCountBySite: (actressId: string) => Promise<Array<{ siteName: string; count: number }>>;
  getActressProductCountByAsp: (actressId: string) => Promise<Array<{ aspName: string; count: number }>>;
  getActressAvgPricePerMin: (actressId: string) => Promise<any>;
  getActressCareerAnalysis: (actressId: string) => Promise<CareerAnalysis | null>;
  getActressBudgetSummary: (actressId: string) => Promise<{
    totalProducts: number;
    pricedProducts: number;
    totalCost: number;
    avgPrice: number;
    minPrice: number;
    maxPrice: number;
    onSaleCount: number;
    totalSavings: number;
  } | null>;

  // Featured / new
  getNewProducts: (limit?: number) => Promise<TProduct[]>;
  getFeaturedProducts: (limit?: number) => Promise<TProduct[]>;
  getFeaturedActresses: (limit?: number) => Promise<TActress[]>;

  // Product sources
  getProductSources: (productId: number) => Promise<any[]>;
  getProductSourcesWithSales: (productId: number) => Promise<any[]>;
  getProductSourcesByMakerCode: (makerProductCode: string) => Promise<any[]>;
  getProductSourcesByTitle: (productId: number, title: string) => Promise<any[]>;
  getSampleImagesByMakerCode: (makerProductCode: string) => Promise<any>;
  getProductMakerCode: (productId: number) => Promise<string | null>;
  getAllProductSources: (
    productId: number,
    title: string,
    makerProductCode: string | null,
  ) => Promise<ProductSourceWithSales[]>;

  // Search
  fuzzySearchProducts: (query: string, limit?: number) => Promise<TProduct[]>;
  getActressesWithNewReleases: (options?: { limit?: number; daysAgo?: number; locale?: string }) => Promise<TActress[]>;

  // Recent / uncategorized
  getRecentProducts: (options?: { limit?: number; locale?: string }) => Promise<TProduct[]>;
  getUncategorizedProducts: (options?: UncategorizedProductsOptions) => Promise<TProduct[]>;
  getUncategorizedProductsCount: (options?: UncategorizedProductsCountOptions) => Promise<number>;

  // Multi-ASP
  getMultiAspActresses: (options?: { limit?: number; minAspCount?: number }) => Promise<TActress[]>;
  getActressesByAsp: (options?: { aspName: string; limit?: number }) => Promise<TActress[]>;

  // Provider / ASP stats
  getProviderProductCounts: () => Promise<Record<string, number>>;
  getAspStats: () => Promise<Array<{ aspName: string; productCount: number; actressCount: number }>>;

  // Categories
  getCategories: (options?: {
    category?: string;
    sortBy?: 'productCount' | 'name';
    limit?: number;
  }) => Promise<CategoryWithCount[]>;
  getProductsByCategory: (tagId: number, options?: any) => Promise<TProduct[]>;
  getProductCountByCategory: (tagId: number, options?: any) => Promise<number>;
  getAspStatsByCategory: (tagId: number) => Promise<Array<{ aspName: string; count: number }>>;

  // Uncategorized stats / candidates
  getUncategorizedStats: () => Promise<UncategorizedStats>;
  getCandidatePerformers: (productCode: string) => Promise<Array<{ name: string; source: string }>>;

  // Sales
  getSaleProducts: (options?: { limit?: number; aspName?: string; minDiscount?: number }) => Promise<SaleProduct[]>;
  getSaleStats: () => Promise<any>;

  // Random
  getRandomProduct: (options?: {
    excludeIds?: number[];
    tags?: string[];
    providers?: string[];
    locale?: string;
  }) => Promise<RandomProduct | null>;

  // Series
  getSeriesByTagId: (tagId: number, locale?: string) => Promise<any>;
  getSeriesInfo: (seriesTagId: number) => Promise<SeriesInfo | null>;
  getSeriesProducts: (
    seriesTagId: number,
    options?: { sortBy?: 'releaseDateAsc' | 'releaseDateDesc' | 'ratingDesc'; locale?: string },
  ) => Promise<any>;
  getPopularSeries: (limit?: number) => Promise<PopularSeries[]>;

  // Maker
  getMakerById: (makerId: number, locale?: string) => Promise<MakerInfo | null>;
  getPopularMakers: (options?: {
    category?: 'maker' | 'label' | 'both';
    limit?: number;
    locale?: string;
  }) => Promise<PopularMaker[]>;
  analyzeMakerPreference: (productIds: number[], locale?: string) => Promise<MakerPreference[]>;

  // ----- Access to underlying shared queries for overrides -----
  _getProductsShared: <T>(options?: GetProductsOptions) => Promise<T[]>;
  _getProductsCountShared: (options?: any) => Promise<number>;
  _getActressesShared: <T>(options?: GetActressesOptions) => Promise<T[]>;
  _getActressesCountShared: (options?: GetActressesCountOptions) => Promise<number>;
  _getSaleProductsShared: (options?: any) => Promise<SaleProduct[]>;
  _getUncategorizedProductsCountShared: (options?: UncategorizedProductsCountOptions) => Promise<number>;
  _createCachedFunction: <TArgs extends unknown[], TResult>(
    fn: (...args: TArgs) => Promise<TResult>,
    keyParts: string[],
    tags?: string[],
    revalidate?: number,
  ) => (...args: TArgs) => Promise<TResult>;
}

// ============================================================
// Factory Implementation
// ============================================================

export function createAppQueries<TProduct, TActress>(deps: CreateAppQueriesDeps): AppQueries<TProduct, TActress> {
  const {
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
    siteMode,
    enableActressFeatureFilter = false,
    isValidPerformerName,
    getDtiServiceFromUrl,
    mapLegacyProvider,
    getProviderLabel,
    getLocalizedTitle,
    getLocalizedDescription,
    getLocalizedPerformerName,
    getLocalizedPerformerBio,
    getLocalizedTagName,
    getLocalizedAiReview,
    generateProductIdVariations,
    buildAspNormalizationSql,
    normalizeAspName,
    unstable_cache,
  } = deps;

  // ============================================================
  // createCachedFunction wrapper
  // ============================================================

  function createCachedFunction<TArgs extends unknown[], TResult>(
    fn: (...args: TArgs) => Promise<TResult>,
    keyParts: string[],
    cacheTags: string[] = [],
    revalidate: number = CACHE_REVALIDATE_SECONDS,
  ) {
    return unstable_cache(fn, keyParts, { revalidate, tags: cacheTags });
  }

  // ============================================================
  // DB types (local to the factory - InferSelectModel equivalent)
  // ============================================================

  type DbProduct = InferSelectModel<typeof products>;
  type DbPerformer = InferSelectModel<typeof performers>;

  // ============================================================
  // isValidPerformer helper
  // ============================================================

  function isValidPerformer(performer: { name: string }): boolean {
    return isValidPerformerName(performer.name);
  }

  // ============================================================
  // Mapper dependencies
  // ============================================================

  const productMapperDeps: ProductMapperDeps = {
    mapLegacyProvider: mapLegacyProvider as any,
    getProviderLabel: getProviderLabel as any,
    getLocalizedPerformerName: getLocalizedPerformerName as any,
    getLocalizedTagName: getLocalizedTagName as any,
    getLocalizedTitle: getLocalizedTitle as any,
    getLocalizedDescription: getLocalizedDescription as any,
  };

  const mapperDeps = {
    getLocalizedPerformerName: getLocalizedPerformerName as any,
    getLocalizedPerformerBio: getLocalizedPerformerBio as any,
    getLocalizedAiReview: getLocalizedAiReview as any,
  };

  // ============================================================
  // Mapper functions
  // ============================================================

  function mapProductToType(
    product: DbProduct,
    performerData: Array<{
      id: number;
      name: string;
      nameKana: string | null;
      nameEn?: string | null;
      nameZh?: string | null;
      nameKo?: string | null;
    }> = [],
    tagData: Array<{
      id: number;
      name: string;
      category: string | null;
      nameEn?: string | null;
      nameZh?: string | null;
      nameKo?: string | null;
    }> = [],
    source?: SourceData | null,
    cache?: CacheData | null,
    imagesData?: Array<{ imageUrl: string; imageType: string; displayOrder: number | null }>,
    videosData?: Array<{ videoUrl: string; videoType: string | null; quality: string | null; duration: number | null }>,
    locale: string = 'ja',
    saleData?: { regularPrice: number; salePrice: number; discountPercent: number | null; endAt?: Date | null },
  ): TProduct {
    return mapProductToTypeBase(
      product as any,
      productMapperDeps,
      performerData,
      tagData,
      source,
      cache,
      imagesData,
      videosData,
      locale,
      saleData,
    ) as unknown as TProduct;
  }

  function mapPerformerToActressTypeSync(
    performer: DbPerformer,
    releaseCount: number,
    thumbnailUrl?: string,
    services?: string[],
    aliases?: string[],
    locale: string = 'ja',
  ): TActress {
    return mapPerformerToActressTypeSyncBase(performer as any, releaseCount, mapperDeps, {
      thumbnailUrl,
      services,
      aliases,
      locale,
    }) as unknown as TActress;
  }

  async function mapPerformerToActressType(performer: DbPerformer, locale: string = 'ja'): Promise<TActress> {
    const db = getDb();

    const [productCountResult, thumbnailResult, servicesResult] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(productPerformers)
        .where(eq(productPerformers.performerId, performer['id'])),
      db
        .select({ thumbnailUrl: products.defaultThumbnailUrl, aspName: productSources.aspName })
        .from(productPerformers)
        .innerJoin(products, eq(productPerformers.productId, products.id))
        .innerJoin(productSources, eq(productPerformers.productId, productSources.productId))
        .where(
          and(
            eq(productPerformers.performerId, performer['id']),
            sql`${products.defaultThumbnailUrl} IS NOT NULL`,
            sql`${products.defaultThumbnailUrl} != ''`,
            sql`(
              EXISTS (
                SELECT 1 FROM ${productSources} ps_check
                WHERE ps_check.product_id = ${products.id}
                AND ps_check.asp_name != 'FANZA'
              ) OR NOT EXISTS (
                SELECT 1 FROM ${productSources} ps_fanza
                WHERE ps_fanza.product_id = ${products.id}
                AND ps_fanza.asp_name = 'FANZA'
              )
            )`,
          ),
        )
        .orderBy(sql`CASE WHEN ${productSources.aspName} != 'DTI' THEN 0 ELSE 1 END`, desc(products.createdAt))
        .limit(1),
      db.execute(sql`
        SELECT DISTINCT
          ${sql.raw(buildAspNormalizationSql('ps.asp_name', 'p.default_thumbnail_url'))} as asp_name
        FROM product_performers pp
        INNER JOIN product_sources ps ON pp.product_id = ps.product_id
        INNER JOIN products p ON pp.product_id = p.id
        WHERE pp.performer_id = ${performer['id']}
        AND ps.asp_name IS NOT NULL
      `),
    ]);

    const releaseCount = productCountResult[0]?.count || 0;
    const thumbnailUrl = thumbnailResult[0]?.thumbnailUrl;
    const services = (servicesResult.rows as { asp_name: string }[])
      .map((r: { asp_name: string }) => r.asp_name)
      .filter((s: string | null): s is string => s !== null && s !== '');

    return mapPerformerToActressTypeSync(
      performer,
      Number(releaseCount),
      thumbnailUrl ?? undefined,
      services,
      undefined,
      locale,
    );
  }

  // ============================================================
  // Initialize sub-factories
  // ============================================================

  // Batch performer queries
  const batchPerformerQueries = createBatchPerformerQueries({
    getDb,
    products,
    productPerformers,
    productSources,
    performerAliases,
    getDtiServiceFromUrl,
  });

  const { batchGetPerformerThumbnails, batchGetPerformerServices, batchGetPerformerAliases } = batchPerformerQueries;

  // Core queries
  const coreQueries = createCoreQueries({
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
    siteMode,
    isValidPerformer: (performer: { name: string }) => isValidPerformerName(performer.name),
  });

  const {
    fetchProductRelatedData: fetchProductRelatedDataShared,
    batchFetchProductRelatedData: batchFetchProductRelatedDataShared,
    getProviderProductCounts: getProviderProductCountsShared,
    getCategories: getCategoriesShared,
    getUncategorizedStats: getUncategorizedStatsShared,
    getCandidatePerformers: getCandidatePerformersShared,
    getTagById: _getTagByIdShared,
    getProductCountByCategory: getProductCountByCategoryShared,
    getAspStatsByCategory: getAspStatsByCategoryShared,
    getSeriesInfo: getSeriesInfoShared,
    getPopularSeries: getPopularSeriesShared,
    getPopularMakers: getPopularMakersShared,
    analyzeMakerPreference: analyzeMakerPreferenceShared,
    getMakerById: getMakerByIdShared,
    getSeriesByTagId: getSeriesByTagIdShared,
    getSeriesProducts: getSeriesProductsShared,
  } = coreQueries;

  // Sale queries
  const saleQueries = createSaleQueries({
    getDb,
    products,
    productSources,
    productSales,
    productPerformers,
    performers,
    siteMode,
    getFromMemoryCache,
    setToMemoryCache,
  });

  const { getSaleProducts: getSaleProductsShared, getSaleStats: getSaleStatsShared } = saleQueries;

  // Actress queries (lazy init)
  let _actressQueries: ReturnType<typeof createActressQueries> | null = null;
  function getActressQueries() {
    if (!_actressQueries) {
      _actressQueries = createActressQueries({
        getDb,
        performers,
        performerAliases,
        productPerformers,
        productSources,
        products,
        mapPerformerToActress: (performer: any, locale: any) =>
          mapPerformerToActressTypeSync(performer as DbPerformer, 0, undefined, undefined, undefined, locale),
        mapPerformerToActressAsync: (performer: any, locale: any) =>
          mapPerformerToActressType(performer as DbPerformer, locale),
        batchGetPerformerThumbnails,
        batchGetPerformerServices,
        batchGetPerformerAliases,
        mapPerformerWithBatchData: (
          performer: any,
          thumbnailUrl: any,
          services: any,
          aliases: any,
          productCount: any,
          locale: any,
        ) =>
          mapPerformerToActressTypeSync(
            performer as DbPerformer,
            productCount,
            thumbnailUrl,
            services,
            aliases,
            locale,
          ),
      });
    }
    return _actressQueries;
  }

  // Actress query wrappers (lazy init)
  function getActressCareerAnalysisShared(actressId: string) {
    return getActressQueries().getActressCareerAnalysis(actressId);
  }
  function getActressAvgPricePerMinShared(actressId: string) {
    return getActressQueries().getActressAvgPricePerMin(actressId);
  }
  function getActressBudgetSummaryShared(actressId: string) {
    return getActressQueries().getActressBudgetSummary(actressId);
  }
  function getMultiAspActressesShared(options?: { limit?: number; minAspCount?: number }) {
    return getActressQueries().getMultiAspActresses(options);
  }
  function getActressesByAspShared(options?: { aspName: string; limit?: number }) {
    return getActressQueries().getActressesByAsp(options);
  }

  // Product list queries
  const productListQueries = createProductListQueries({
    getDb,
    products,
    productSources,
    productPerformers,
    productTags,
    productImages,
    productVideos,
    productSales,
    productRatingSummary,
    siteMode,
    batchFetchProductRelatedData: batchFetchProductRelatedDataShared,
    mapperDeps: {
      mapLegacyProvider: mapLegacyProvider as any,
      getProviderLabel: getProviderLabel as any,
      getLocalizedPerformerName: getLocalizedPerformerName as any,
      getLocalizedTagName: getLocalizedTagName as any,
      getLocalizedTitle: getLocalizedTitle as any,
      getLocalizedDescription: getLocalizedDescription as any,
      isValidPerformer: (performer: { name: string }) => isValidPerformerName(performer.name),
    },
    fetchProductRelatedData: fetchProductRelatedDataShared,
    mapProductToType: (
      product: any,
      perfData: any,
      tagsData: any,
      source: any,
      cache: any,
      images: any,
      videos: any,
      locale: any,
    ) =>
      mapProductToType(
        product as DbProduct,
        perfData as { id: number; name: string; nameKana: string | null }[],
        tagsData as { id: number; name: string; category: string | null }[],
        source as SourceData,
        cache as CacheData | undefined,
        images as { imageUrl: string; imageType: string; displayOrder: number | null }[],
        videos as { videoUrl: string; videoType: string | null; quality: string | null; duration: number | null }[],
        locale,
      ),
  });

  const {
    getProducts: getProductsShared,
    getProductsCount: getProductsCountShared,
    getProductsByCategory: getProductsByCategoryShared,
  } = productListQueries;

  // Actress list queries
  const actressListQueries = createActressListQueries({
    getDb,
    performers,
    performerAliases,
    productPerformers,
    productTags,
    productSources,
    productImages,
    productVideos,
    siteMode,
    enableActressFeatureFilter,
    mapPerformerToActress: (
      performer: any,
      productCount: any,
      thumbnail: any,
      services: any,
      aliases: any,
      locale: any,
    ) => mapPerformerToActressTypeSync(performer as DbPerformer, productCount, thumbnail, services, aliases, locale),
    batchGetPerformerThumbnails,
    batchGetPerformerServices,
    batchGetPerformerAliases,
    getFromMemoryCache,
    setToMemoryCache,
  });

  const { getActresses: getActressesShared, getActressesCount: getActressesCountShared } = actressListQueries;

  // Uncategorized queries
  const uncategorizedQueries = createUncategorizedQueries({
    getDb,
    siteMode,
    fetchProductRelatedData: fetchProductRelatedDataShared,
    getFromMemoryCache,
    setToMemoryCache,
  });

  const {
    getUncategorizedProducts: getUncategorizedProductsShared,
    getUncategorizedProductsCount: getUncategorizedProductsCountShared,
  } = uncategorizedQueries;

  // Product queries
  const productQueries = createProductQueries({
    getDb,
    products,
    performers,
    productPerformers,
    tags,
    productTags,
    productSources,
    productImages,
    productVideos,
    productSales,
    siteMode,
    mapProductToType: (
      product: any,
      perfData: any,
      tagsData: any,
      source: any,
      cache: any,
      images: any,
      videos: any,
      locale: any,
      saleData: any,
    ) =>
      mapProductToType(
        product as DbProduct,
        perfData as { id: number; name: string; nameKana: string | null }[],
        tagsData as { id: number; name: string; category: string | null }[],
        source as SourceData,
        cache as CacheData | undefined,
        images as { imageUrl: string; imageType: string; displayOrder: number | null }[],
        videos as { videoUrl: string; videoType: string | null; quality: string | null; duration: number | null }[],
        locale,
        saleData,
      ),
    fetchProductRelatedData: fetchProductRelatedDataShared,
    isValidPerformer,
    generateProductIdVariations,
  });

  const {
    getProductById: getProductByIdShared,
    searchProductByProductId: searchProductByProductIdShared,
    getProductSources: _getProductSourcesFromFactory,
    getProductSourcesWithSales: _getProductSourcesWithSalesShared,
    getProductSourcesByMakerCode: _getProductSourcesByMakerCodeShared,
    getProductMakerCode: _getProductMakerCodeShared,
    fuzzySearchProducts: fuzzySearchProductsShared,
    getRecentProducts: getRecentProductsShared,
    getSampleImagesByMakerCode: getSampleImagesByMakerCodeShared,
  } = productQueries;

  // ============================================================
  // Query wrapper functions
  // ============================================================

  async function getProductById(id: string, locale: string = 'ja'): Promise<TProduct | null> {
    return getProductByIdShared(id, locale) as Promise<TProduct | null>;
  }

  async function searchProductByProductId(productId: string, locale: string = 'ja'): Promise<TProduct | null> {
    return searchProductByProductIdShared(productId, locale) as Promise<TProduct | null>;
  }

  // getProducts - base version (no app-specific caching)
  async function getProducts(options?: GetProductsOptions): Promise<TProduct[]> {
    return getProductsShared(options) as Promise<TProduct[]>;
  }

  // getProductsCount - base version (no app-specific caching)
  async function getProductsCount(
    options?: Omit<GetProductsOptions, 'limit' | 'offset' | 'sortBy' | 'locale'>,
  ): Promise<number> {
    return getProductsCountShared(options);
  }

  async function getProductsByActress(actressId: string, locale: string = 'ja'): Promise<TProduct[]> {
    try {
      return await getProducts({ actressId, sortBy: 'releaseDateDesc', limit: 1000, locale });
    } catch (error) {
      console.error(`Error fetching products for actress ${actressId}:`, error);
      throw error;
    }
  }

  // getActresses - base version (no app-specific caching)
  async function getActresses(options?: GetActressesOptions): Promise<TActress[]> {
    return getActressesShared(options) as Promise<TActress[]>;
  }

  // getActressesCount - base version (no app-specific caching)
  async function getActressesCount(options?: GetActressesCountOptions): Promise<number> {
    return getActressesCountShared(options);
  }

  // Tags
  async function getTagsInternal(
    category?: string,
  ): Promise<Array<{ id: number; name: string; category: string | null }>> {
    try {
      const db = getDb();
      const results = await db
        .select({
          id: tags.id,
          name: tags.name,
          category: tags.category,
        })
        .from(tags)
        .where(category ? eq(tags.category, category) : undefined)
        .orderBy(tags.name);

      return results;
    } catch (error) {
      console.error('Error fetching tags:', error);
      throw error;
    }
  }

  const getCachedTags = createCachedFunction(getTagsInternal, ['tags'], ['tags'], CACHE_REVALIDATE_SECONDS);

  async function getTags(category?: string): Promise<Array<{ id: number; name: string; category: string | null }>> {
    return getCachedTags(category);
  }

  async function getTagsForActressInternal(
    actressId: string,
    category?: string,
  ): Promise<Array<{ id: number; name: string; category: string | null }>> {
    try {
      const db = getDb();
      const performerId = parseInt(actressId);

      if (isNaN(performerId)) {
        return [];
      }

      const actressProductIds = await db
        .selectDistinct({ productId: productPerformers.productId })
        .from(productPerformers)
        .where(eq(productPerformers.performerId, performerId));

      if (actressProductIds.length === 0) {
        return [];
      }

      const productIdList = actressProductIds.map((p: any) => p.productId);

      const results = await db
        .selectDistinct({
          id: tags.id,
          name: tags.name,
          category: tags.category,
        })
        .from(tags)
        .innerJoin(productTags, eq(tags.id, productTags.tagId))
        .where(and(category ? eq(tags.category, category) : undefined, inArray(productTags.productId, productIdList)))
        .orderBy(tags.name);

      return results;
    } catch (error) {
      console.error('Error fetching tags for actress:', error);
      throw error;
    }
  }

  async function getTagsForActress(
    actressId: string,
    category?: string,
  ): Promise<Array<{ id: number; name: string; category: string | null }>> {
    const cached = unstable_cache(
      () => getTagsForActressInternal(actressId, category),
      [`actress-tags-${actressId}-${category || 'all'}`],
      { revalidate: 600, tags: ['actress-tags'] },
    );
    return cached();
  }

  async function getActressById(id: string, locale: string = 'ja'): Promise<TActress | null> {
    return getActressQueries().getActressById(id, locale) as Promise<TActress | null>;
  }

  async function getPerformerAliasesInternal(performerId: number): Promise<
    Array<{
      id: number;
      aliasName: string;
      source: string | null;
      isPrimary: boolean | null;
      createdAt: Date;
    }>
  > {
    try {
      const db = getDb();
      const aliases = await db
        .select()
        .from(performerAliases)
        .where(eq(performerAliases.performerId, performerId))
        .orderBy(desc(performerAliases.isPrimary), asc(performerAliases.aliasName));

      return aliases;
    } catch (error) {
      console.error(`Error fetching aliases for performer ${performerId}:`, error);
      return [];
    }
  }

  async function getPerformerAliases(performerId: number): Promise<
    Array<{
      id: number;
      aliasName: string;
      source: string | null;
      isPrimary: boolean | null;
      createdAt: Date;
    }>
  > {
    const cached = unstable_cache(
      () => getPerformerAliasesInternal(performerId),
      [`performer-aliases-${performerId}`],
      { revalidate: 3600, tags: ['performer-aliases'] },
    );
    return cached();
  }

  async function getActressProductCountBySite(actressId: string): Promise<
    Array<{
      siteName: string;
      count: number;
    }>
  > {
    try {
      const db = getDb();
      const performerId = parseInt(actressId);

      if (isNaN(performerId)) {
        return [];
      }

      const results = await db
        .select({
          siteName: tags.name,
          count: sql<number>`COUNT(DISTINCT ${products.id})`,
        })
        .from(products)
        .innerJoin(productPerformers, eq(products.id, productPerformers.productId))
        .innerJoin(productTags, eq(products.id, productTags.productId))
        .innerJoin(tags, eq(productTags.tagId, tags.id))
        .where(and(eq(productPerformers.performerId, performerId), eq(tags.category, 'site')))
        .groupBy(tags.name)
        .orderBy(desc(sql<number>`COUNT(DISTINCT ${products.id})`));

      return results.map((r: any) => ({
        siteName: r.siteName,
        count: Number(r.count),
      }));
    } catch (error) {
      console.error(`Error fetching product count by site for actress ${actressId}:`, error);
      return [];
    }
  }

  async function getActressProductCountByAspInternal(actressId: string): Promise<
    Array<{
      aspName: string;
      count: number;
    }>
  > {
    try {
      const db = getDb();
      const performerId = parseInt(actressId);

      if (isNaN(performerId)) {
        return [];
      }

      const aspNormalizeSql = buildAspNormalizationSql('ps.asp_name', 'p.default_thumbnail_url');
      const results = await db.execute(sql`
        SELECT
          ${sql.raw(aspNormalizeSql)} as asp_name,
          COUNT(DISTINCT pp.product_id) as count
        FROM product_performers pp
        INNER JOIN product_sources ps ON pp.product_id = ps.product_id
        INNER JOIN products p ON pp.product_id = p.id
        WHERE pp.performer_id = ${performerId}
        AND ps.asp_name IS NOT NULL
        GROUP BY ${sql.raw(aspNormalizeSql)}
        ORDER BY count DESC
      `);

      return (results.rows || [])
        .filter((r: any) => r.asp_name !== null)
        .map((r: any) => ({
          aspName: r.asp_name,
          count: parseInt(r.count, 10),
        }));
    } catch (error) {
      console.error(`Error fetching product count by ASP for actress ${actressId}:`, error);
      return [];
    }
  }

  async function getActressProductCountByAsp(actressId: string): Promise<
    Array<{
      aspName: string;
      count: number;
    }>
  > {
    const cached = unstable_cache(
      () => getActressProductCountByAspInternal(actressId),
      [`actress-asp-count-${actressId}`],
      { revalidate: 600, tags: ['actress-asp-count'] },
    );
    return cached();
  }

  async function getNewProducts(limit = 100): Promise<TProduct[]> {
    return getProducts({ isNew: true, sortBy: 'releaseDateDesc', limit });
  }

  async function getFeaturedProducts(limit = 100): Promise<TProduct[]> {
    return getProducts({ isFeatured: true, sortBy: 'releaseDateDesc', limit });
  }

  async function getFeaturedActresses(limit = 3): Promise<TActress[]> {
    try {
      return await getActresses({ limit });
    } catch (error) {
      console.error('Error fetching featured actresses:', error);
      throw error;
    }
  }

  async function getProductSources(productId: number) {
    try {
      const db = getDb();
      const sources = await db
        .select({
          aspName: productSources.aspName,
          originalProductId: productSources.originalProductId,
          price: productSources.price,
          currency: productSources.currency,
          affiliateUrl: productSources.affiliateUrl,
        })
        .from(productSources)
        .where(eq(productSources.productId, productId));

      return sources;
    } catch (error) {
      console.error(`Error fetching product sources for product ${productId}:`, error);
      return [];
    }
  }

  async function getProductSourcesWithSales(productId: number) {
    try {
      const db = getDb();

      const sources = await db
        .select({
          id: productSources.id,
          aspName: productSources.aspName,
          originalProductId: productSources.originalProductId,
          price: productSources.price,
          currency: productSources.currency,
          affiliateUrl: productSources.affiliateUrl,
          isSubscription: productSources.isSubscription,
          productType: productSources.productType,
        })
        .from(productSources)
        .where(and(eq(productSources.productId, productId), sql`LOWER(${productSources.aspName}) != 'fanza'`));

      if (sources.length === 0) {
        return [];
      }

      const sourceIds = sources.map((s: any) => s.id);
      const sales = await db
        .select({
          productSourceId: productSales.productSourceId,
          regularPrice: productSales.regularPrice,
          salePrice: productSales.salePrice,
          discountPercent: productSales.discountPercent,
          endAt: productSales.endAt,
          isActive: productSales.isActive,
        })
        .from(productSales)
        .where(
          and(
            inArray(productSales.productSourceId, sourceIds),
            eq(productSales.isActive, true),
            sql`${productSales.fetchedAt} > NOW() - INTERVAL '14 days'`,
          ),
        );

      const saleMap = new Map(sales.map((s: any) => [s.productSourceId, s]));

      return sources
        .map((source: any) => {
          const sale = saleMap.get(source.id) as any;
          return {
            aspName: source.aspName,
            originalProductId: source.originalProductId,
            regularPrice: sale?.regularPrice ?? source.price,
            salePrice: sale?.salePrice ?? null,
            discountPercent: sale?.discountPercent ?? null,
            saleEndAt: sale?.endAt ?? null,
            currency: source.currency,
            affiliateUrl: source.affiliateUrl,
            isSubscription: source.isSubscription,
            productType: source.productType,
            isOnSale: !!sale,
          };
        })
        .sort((a: any, b: any) => {
          const priceA = a.salePrice ?? a.regularPrice ?? Infinity;
          const priceB = b.salePrice ?? b.regularPrice ?? Infinity;
          return priceA - priceB;
        });
    } catch (error) {
      console.error(`Error fetching product sources with sales for product ${productId}:`, error);
      return [];
    }
  }

  async function fuzzySearchProducts(query: string, limit: number = 20): Promise<TProduct[]> {
    return fuzzySearchProductsShared(query, limit, getProductById) as Promise<TProduct[]>;
  }

  async function getActressesWithNewReleases(
    options: {
      limit?: number;
      daysAgo?: number;
      locale?: string;
    } = {},
  ): Promise<TActress[]> {
    return getActressQueries().getActressesWithNewReleases({
      ...options,
      getActressByIdCallback: getActressById,
    });
  }

  async function getPopularTagsUncached(
    options: { category?: string; limit?: number } = {},
  ): Promise<Array<{ id: number; name: string; category: string | null; count: number }>> {
    try {
      const { category, limit = 20 } = options;
      const db = getDb();

      const result = await db
        .select({
          id: tags.id,
          name: tags.name,
          category: tags.category,
          count: sql<number>`CAST(COUNT(DISTINCT ${productTags.productId}) AS INTEGER)`,
        })
        .from(tags)
        .leftJoin(productTags, eq(tags.id, productTags.tagId))
        .where(category ? eq(tags.category, category) : undefined)
        .groupBy(tags.id, tags.name, tags.category)
        .orderBy(desc(sql`COUNT(DISTINCT ${productTags.productId})`))
        .limit(limit);

      return result;
    } catch (error) {
      console.error('Error getting popular tags:', error);
      throw error;
    }
  }

  const getCachedPopularTags = unstable_cache(
    async (category: string | undefined, limit: number) => {
      return getPopularTagsUncached({ category, limit });
    },
    ['popular-tags'],
    { revalidate: 300 },
  );

  async function getPopularTags(
    options: { category?: string; limit?: number } = {},
  ): Promise<Array<{ id: number; name: string; category: string | null; count: number }>> {
    return getCachedPopularTags(options.category, options.limit ?? 20);
  }

  async function getRecentProducts(options?: { limit?: number; locale?: string }): Promise<TProduct[]> {
    return getRecentProductsShared(options) as Promise<TProduct[]>;
  }

  async function getUncategorizedProducts(options?: UncategorizedProductsOptions): Promise<TProduct[]> {
    return getUncategorizedProductsShared(options) as Promise<TProduct[]>;
  }

  // getUncategorizedProductsCount - base version (no app-specific caching)
  async function getUncategorizedProductsCount(options?: UncategorizedProductsCountOptions): Promise<number> {
    return getUncategorizedProductsCountShared(options);
  }

  async function getMultiAspActresses(options: { limit?: number; minAspCount?: number } = {}): Promise<TActress[]> {
    return getMultiAspActressesShared(options) as Promise<TActress[]>;
  }

  async function getActressesByAsp(
    options: { aspName: string; limit?: number } = { aspName: 'DUGA' },
  ): Promise<TActress[]> {
    return getActressesByAspShared(options) as Promise<TActress[]>;
  }

  async function getProviderProductCounts(): Promise<Record<string, number>> {
    return getProviderProductCountsShared();
  }

  // ASP stats
  async function getAspStatsInternal(): Promise<
    Array<{ aspName: string; productCount: number; actressCount: number }>
  > {
    const db = getDb();

    const aspNormalizeSql = buildAspNormalizationSql('ps.asp_name', 'p.default_thumbnail_url');
    const result = await db.execute(sql`
      SELECT
        ${sql.raw(aspNormalizeSql)} as asp_name,
        COUNT(DISTINCT ps.product_id) as product_count,
        COUNT(DISTINCT pp.performer_id) as actress_count
      FROM product_sources ps
      LEFT JOIN products p ON ps.product_id = p.id
      LEFT JOIN product_performers pp ON ps.product_id = pp.product_id
      WHERE ps.asp_name IS NOT NULL
        AND UPPER(ps.asp_name) != 'FANZA'
      GROUP BY ${sql.raw(aspNormalizeSql)}
      ORDER BY product_count DESC
    `);

    if (!result.rows) return [];

    const merged = new Map<string, { productCount: number; actressCount: number }>();
    for (const row of result.rows) {
      const normalized = normalizeAspName(row.asp_name);
      if (normalized === 'fanza') continue;
      const existing = merged.get(normalized);
      if (existing) {
        existing.productCount += parseInt(row['product_count'], 10);
        existing.actressCount += parseInt(row.actress_count, 10);
      } else {
        merged.set(normalized, {
          productCount: parseInt(row['product_count'], 10),
          actressCount: parseInt(row.actress_count, 10),
        });
      }
    }

    return Array.from(merged.entries()).map(([aspName, stats]) => ({
      aspName,
      productCount: stats.productCount,
      actressCount: stats.actressCount,
    }));
  }

  const getCachedAspStats = createCachedFunction(
    async () => {
      try {
        return await getAspStatsInternal();
      } catch (error) {
        console.error('Error getting ASP stats:', error);
        return [];
      }
    },
    ['aspStats'],
    ['asp-stats'],
    CACHE_REVALIDATE_SECONDS,
  );

  async function getAspStats(): Promise<Array<{ aspName: string; productCount: number; actressCount: number }>> {
    return getCachedAspStats();
  }

  async function getCategories(options?: {
    category?: string;
    sortBy?: 'productCount' | 'name';
    limit?: number;
  }): Promise<CategoryWithCount[]> {
    return getCategoriesShared(options);
  }

  async function getProductsByCategory(
    tagId: number,
    options?: {
      limit?: number;
      offset?: number;
      sortBy?: 'releaseDateDesc' | 'releaseDateAsc';
      initial?: string;
      includeAsp?: string[];
      excludeAsp?: string[];
      hasVideo?: boolean;
      hasImage?: boolean;
      performerType?: 'solo' | 'multi';
      locale?: string;
    },
  ): Promise<TProduct[]> {
    return getProductsByCategoryShared(tagId, options) as Promise<TProduct[]>;
  }

  async function getProductCountByCategory(
    tagId: number,
    options?: {
      initial?: string;
      includeAsp?: string[];
      excludeAsp?: string[];
      hasVideo?: boolean;
      hasImage?: boolean;
      performerType?: 'solo' | 'multi';
    },
  ): Promise<number> {
    return getProductCountByCategoryShared(tagId, options);
  }

  async function getAspStatsByCategory(tagId: number): Promise<Array<{ aspName: string; count: number }>> {
    return getAspStatsByCategoryShared(tagId);
  }

  async function getTagById(tagId: number): Promise<{
    id: number;
    name: string;
    nameEn: string | null;
    nameZh: string | null;
    nameKo: string | null;
    category: string | null;
  } | null> {
    try {
      const db = getDb();
      const result = await db.select().from(tags).where(eq(tags.id, tagId)).limit(1);

      if (result.length === 0) return null;

      return {
        id: result[0].id,
        name: result[0].name,
        nameEn: result[0].nameEn,
        nameZh: result[0].nameZh,
        nameKo: result[0].nameKo,
        category: result[0].category,
      };
    } catch (error) {
      console.error('Error getting tag by id:', error);
      return null;
    }
  }

  async function getUncategorizedStats(): Promise<UncategorizedStats> {
    return getUncategorizedStatsShared();
  }

  async function getCandidatePerformers(productCode: string): Promise<
    Array<{
      name: string;
      source: string;
    }>
  > {
    return getCandidatePerformersShared(productCode);
  }

  // getSaleProducts - base version (no app-specific caching)
  async function getSaleProducts(options?: {
    limit?: number;
    aspName?: string;
    minDiscount?: number;
  }): Promise<SaleProduct[]> {
    return getSaleProductsShared(options);
  }

  function getSaleStats() {
    return getSaleStatsShared();
  }

  async function getRandomProduct(options?: {
    excludeIds?: number[];
    tags?: string[];
    providers?: string[];
    locale?: string;
  }): Promise<RandomProduct | null> {
    try {
      const db = getDb();
      const locale = options?.locale || 'ja';
      const conditions = [];

      if (options?.excludeIds && options.excludeIds.length > 0) {
        conditions.push(sql`p.id NOT IN ${options.excludeIds}`);
      }

      if (options?.tags && options.tags.length > 0) {
        conditions.push(sql`EXISTS (
          SELECT 1 FROM product_tags pt
          JOIN tags t ON pt.tag_id = t.id
          WHERE pt.product_id = p.id AND t.id IN ${options.tags.map((t) => parseInt(t))}
        )`);
      }

      if (options?.providers && options.providers.length > 0) {
        conditions.push(sql`EXISTS (
          SELECT 1 FROM product_sources ps
          WHERE ps.product_id = p.id AND ps.asp_name IN ${options.providers}
        )`);
      }

      conditions.push(sql`p.sample_images IS NOT NULL AND jsonb_array_length(p.sample_images) > 0`);

      const whereClause =
        conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql`WHERE p.sample_images IS NOT NULL`;

      const result = await db.execute(sql`
        SELECT
          p.id,
          COALESCE(${locale === 'en' ? sql`p.title_en` : locale === 'zh' ? sql`p.title_zh` : locale === 'ko' ? sql`p.title_ko` : sql`p.title`}, p.title) as title,
          p.image_url,
          p.sample_images,
          p.release_date,
          p.duration,
          ps.price,
          ps.asp_name as provider
        FROM products p
        LEFT JOIN LATERAL (
          SELECT price, asp_name FROM product_sources
          WHERE product_id = p.id
          ORDER BY price NULLS LAST
          LIMIT 1
        ) ps ON true
        ${whereClause}
        ORDER BY RANDOM()
        LIMIT 1
      `);

      if (!result.rows || result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0] as Record<string, unknown>;
      return {
        id: row['id'] as number,
        title: row['title'] as string,
        imageUrl: row['image_url'] as string,
        sampleImages: row['sample_images'] as string[] | null,
        releaseDate: row['release_date'] as string | null,
        duration: row['duration'] as number | null,
        price: row['price'] as number | null,
        provider: row['provider'] as string | null,
      };
    } catch (error) {
      console.error('Error fetching random product:', error);
      return null;
    }
  }

  async function getSeriesByTagId(tagId: number, locale: string = 'ja') {
    return getSeriesByTagIdShared(tagId, locale);
  }

  async function getMakerById(makerId: number, locale: string = 'ja'): Promise<MakerInfo | null> {
    return getMakerByIdShared(makerId, locale);
  }

  async function getPopularMakers(options?: {
    category?: 'maker' | 'label' | 'both';
    limit?: number;
    locale?: string;
  }): Promise<PopularMaker[]> {
    return getPopularMakersShared(options);
  }

  async function analyzeMakerPreference(productIds: number[], locale: string = 'ja'): Promise<MakerPreference[]> {
    return analyzeMakerPreferenceShared(productIds, locale);
  }

  async function getSeriesInfo(seriesTagId: number): Promise<SeriesInfo | null> {
    return getSeriesInfoShared(seriesTagId);
  }

  async function getSeriesProducts(
    seriesTagId: number,
    options?: {
      sortBy?: 'releaseDateAsc' | 'releaseDateDesc' | 'ratingDesc';
      locale?: string;
    },
  ) {
    return getSeriesProductsShared(seriesTagId, options);
  }

  async function getPopularSeries(limit: number = 20): Promise<PopularSeries[]> {
    return getPopularSeriesShared(limit);
  }

  async function getProductSourcesByMakerCode(makerProductCode: string) {
    if (!makerProductCode) return [];

    try {
      const db = getDb();
      const normalizedCode = makerProductCode.toLowerCase().replace(/[-_]/g, '');

      const result = await db.execute(sql`
        SELECT DISTINCT ON (ps.asp_name)
          ps.id,
          ps.product_id,
          ps.asp_name,
          ps.original_product_id,
          ps.price,
          ps.currency,
          ps.affiliate_url,
          ps.is_subscription,
          ps.product_type,
          psa.regular_price,
          psa.sale_price,
          psa.discount_percent,
          psa.end_at,
          psa.is_active
        FROM product_sources ps
        JOIN products p ON p.id = ps.product_id
        LEFT JOIN product_sales psa ON psa.product_source_id = ps.id AND psa.is_active = true AND psa.fetched_at > NOW() - INTERVAL '14 days'
        WHERE LOWER(REPLACE(REPLACE(p.maker_product_code, '-', ''), '_', '')) = ${normalizedCode}
          AND LOWER(ps.asp_name) != 'fanza'
        ORDER BY ps.asp_name, COALESCE(psa.sale_price, ps.price) ASC NULLS LAST
      `);

      return (result.rows || []).map((row: any) => ({
        aspName: row.asp_name,
        originalProductId: row.original_product_id,
        regularPrice: row.regular_price ?? row.price,
        salePrice: row.sale_price ?? null,
        discountPercent: row.discount_percent ?? null,
        saleEndAt: row.end_at ?? null,
        currency: row.currency,
        affiliateUrl: row.affiliate_url,
        isSubscription: row.is_subscription,
        productType: row.product_type,
        isOnSale: row.is_active === true,
      }));
    } catch (error) {
      console.error(`Error fetching sources by maker code ${makerProductCode}:`, error);
      return [];
    }
  }

  async function getProductSourcesByTitle(productId: number, title: string) {
    if (!title) return [];

    try {
      const db = getDb();

      const normalizedTitle = title
        .replace(/[\s\u3000]+/g, '')
        .replace(
          /[\uff01!?\uff1f\u300c\u300d\u300e\u300f\u3010\u3011\uff08\uff09()\uff06&\uff5e~\u30fb:\uff1a,\uff0c\u3002.\u3001]/g,
          '',
        );

      const result = await db.execute(sql`
        SELECT DISTINCT ON (ps.asp_name)
          ps.id,
          ps.product_id,
          ps.asp_name,
          ps.original_product_id,
          ps.price,
          ps.currency,
          ps.affiliate_url,
          ps.is_subscription,
          ps.product_type,
          psa.regular_price,
          psa.sale_price,
          psa.discount_percent,
          psa.end_at,
          psa.is_active
        FROM product_sources ps
        JOIN products p ON p.id = ps.product_id
        LEFT JOIN product_sales psa ON psa.product_source_id = ps.id AND psa.is_active = true AND psa.fetched_at > NOW() - INTERVAL '14 days'
        WHERE LOWER(REGEXP_REPLACE(REGEXP_REPLACE(p.title, '[[:space:]\u3000]+', '', 'g'), '[\uff01!\uff1f?\u300c\u300d\u300e\u300f\u3010\u3011\uff08\uff09()\uff06&\uff5e~\u30fb:\uff1a,\uff0c\u3002.\u3001]', '', 'g')) = LOWER(${normalizedTitle})
          AND LOWER(ps.asp_name) != 'fanza'
        ORDER BY ps.asp_name, COALESCE(psa.sale_price, ps.price) ASC NULLS LAST
      `);

      return (result.rows || []).map((row: any) => ({
        aspName: row.asp_name,
        originalProductId: row.original_product_id,
        regularPrice: row.regular_price ?? row.price,
        salePrice: row.sale_price ?? null,
        discountPercent: row.discount_percent ?? null,
        saleEndAt: row.end_at ?? null,
        currency: row.currency,
        affiliateUrl: row.affiliate_url,
        isSubscription: row.is_subscription,
        productType: row.product_type,
        isOnSale: row.is_active === true,
      }));
    } catch (error) {
      console.error(`Error fetching sources by title:`, error);
      return [];
    }
  }

  async function getSampleImagesByMakerCode(makerProductCode: string) {
    return getSampleImagesByMakerCodeShared(makerProductCode, {
      includeImageType: true,
      filterImageTypes: ['sample', 'screenshot'],
      limit: 50,
    });
  }

  async function getProductMakerCode(productId: number): Promise<string | null> {
    try {
      const db = getDb();
      const result = await db.execute(sql`
        SELECT maker_product_code FROM products WHERE id = ${productId}
      `);
      return result.rows?.[0]?.maker_product_code ?? null;
    } catch (error) {
      console.error(`Error fetching maker code for product ${productId}:`, error);
      return null;
    }
  }

  async function getAllProductSources(
    productId: number,
    title: string,
    makerProductCode: string | null,
  ): Promise<ProductSourceWithSales[]> {
    const [codeBasedSources, titleBasedSources, productIdSources] = await Promise.all([
      makerProductCode ? getProductSourcesByMakerCode(makerProductCode) : Promise.resolve([]),
      getProductSourcesByTitle(productId, title),
      getProductSourcesWithSales(productId),
    ]);

    const sourceMap = new Map<string, ProductSourceWithSales>();
    for (const source of [...productIdSources, ...titleBasedSources, ...codeBasedSources]) {
      sourceMap.set(source.aspName, source);
    }

    return Array.from(sourceMap.values()).sort((a, b) => {
      const priceA = a.salePrice ?? a.regularPrice ?? Infinity;
      const priceB = b.salePrice ?? b.regularPrice ?? Infinity;
      return priceA - priceB;
    });
  }

  // ============================================================
  // Return assembled queries object
  // ============================================================

  return {
    // Product by ID
    getProductById,
    searchProductByProductId,

    // Product lists (base)
    getProducts,
    getProductsCount,
    getProductsByActress,

    // Actress lists (base)
    getActresses,
    getActressesCount,

    // Tags
    getTags,
    getTagsForActress,
    getPopularTags,
    getTagById,

    // Actress detail
    getActressById,
    getPerformerAliases,
    getActressProductCountBySite,
    getActressProductCountByAsp,
    getActressAvgPricePerMin: getActressAvgPricePerMinShared,
    getActressCareerAnalysis: getActressCareerAnalysisShared,
    getActressBudgetSummary: getActressBudgetSummaryShared,

    // Featured / new
    getNewProducts,
    getFeaturedProducts,
    getFeaturedActresses,

    // Product sources
    getProductSources,
    getProductSourcesWithSales,
    getProductSourcesByMakerCode,
    getProductSourcesByTitle,
    getSampleImagesByMakerCode,
    getProductMakerCode,
    getAllProductSources,

    // Search
    fuzzySearchProducts,
    getActressesWithNewReleases,

    // Recent / uncategorized
    getRecentProducts,
    getUncategorizedProducts,
    getUncategorizedProductsCount,

    // Multi-ASP
    getMultiAspActresses,
    getActressesByAsp,

    // Provider / ASP stats
    getProviderProductCounts,
    getAspStats,

    // Categories
    getCategories,
    getProductsByCategory,
    getProductCountByCategory,
    getAspStatsByCategory,

    // Uncategorized stats / candidates
    getUncategorizedStats,
    getCandidatePerformers,

    // Sales
    getSaleProducts,
    getSaleStats,

    // Random
    getRandomProduct,

    // Series
    getSeriesByTagId,
    getSeriesInfo,
    getSeriesProducts,
    getPopularSeries,

    // Maker
    getMakerById,
    getPopularMakers,
    analyzeMakerPreference,

    // Internal shared accessors for app-level overrides
    _getProductsShared: getProductsShared as any,
    _getProductsCountShared: getProductsCountShared,
    _getActressesShared: getActressesShared as any,
    _getActressesCountShared: getActressesCountShared,
    _getSaleProductsShared: getSaleProductsShared,
    _getUncategorizedProductsCountShared: getUncategorizedProductsCountShared,
    _createCachedFunction: createCachedFunction,
  };
}
