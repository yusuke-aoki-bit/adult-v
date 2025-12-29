import { getDb } from './index';
import { products, performers, productPerformers, tags, productTags, productSources, performerAliases, productImages, productVideos, productSales, productRatingSummary } from './schema';
import { eq, and, desc, asc, sql, inArray } from 'drizzle-orm';
import type { Product as ProductType, Actress as ActressType } from '@/types/product';
import type { InferSelectModel } from 'drizzle-orm';
import { mapLegacyProvider } from '@/lib/provider-utils';
import { getDtiServiceFromUrl } from '@/lib/image-utils';
// ASP_TO_PROVIDER_ID may be used in future filter implementations
// import { ASP_TO_PROVIDER_ID } from '@/lib/constants/filters';
import { getLocalizedTitle, getLocalizedDescription, getLocalizedPerformerName, getLocalizedPerformerBio, getLocalizedTagName, getLocalizedAiReview } from '@/lib/localization';
import { unstable_cache } from 'next/cache';
import {
  generateProductIdVariations,
  buildAspNormalizationSql,
  normalizeAspName,
  getProviderLabel,
  isValidPerformerName,
  mapPerformerToActressTypeSync as mapPerformerToActressTypeSyncBase,
  mapProductToType as mapProductToTypeBase,
  createBatchPerformerQueries,
  createCoreQueries,
  createSaleQueries,
  createActressQueries,
  createProductListQueries,
  createActressListQueries,
  createUncategorizedQueries,
  createProductQueries,
  getFromMemoryCache,
  setToMemoryCache,
  CACHE_REVALIDATE_SECONDS,
} from '@adult-v/shared';
import type {
  ProductMapperDeps,
  MapperSourceData as SourceData,
  CareerAnalysis,
  SaleProduct,
  BatchRelatedDataResult,
  GetProductsOptions as SharedGetProductsOptions,
  ProductSortOption,
  ActressSortOption,
  GetActressesOptions as SharedGetActressesOptions,
  GetActressesCountOptions as SharedGetActressesCountOptions,
  UncategorizedProductsOptions,
  UncategorizedProductsCountOptions,
  CategoryWithCount,
  UncategorizedStats,
  SeriesInfo as SharedSeriesInfo,
  SeriesProduct,
  PopularSeries,
  PopularMaker,
  MakerPreference,
  MakerInfo as SharedMakerInfo,
} from '@adult-v/shared';
export type { SaleProduct, CareerAnalysis };

// Note: generateActressId is exported from ./queries/utils.ts

// unstable_cacheラッパー - インスタンス間で共有されるキャッシュ
function createCachedFunction<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  keyParts: string[],
  tags: string[] = [],
  revalidate: number = CACHE_REVALIDATE_SECONDS
) {
  return unstable_cache(fn, keyParts, { revalidate, tags });
}

type DbProduct = InferSelectModel<typeof products>;
type DbPerformer = InferSelectModel<typeof performers>;

// バッチ女優クエリファクトリーを初期化
const batchPerformerQueries = createBatchPerformerQueries({
  getDb,
  products,
  productPerformers,
  productSources,
  performerAliases,
  getDtiServiceFromUrl,
});

// 共通バッチ関数をエクスポート
const { batchGetPerformerThumbnails, batchGetPerformerServices, batchGetPerformerAliases } = batchPerformerQueries;

// コアクエリファクトリーを初期化
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
  siteMode: 'all',
  isValidPerformer: (performer: { name: string }) => isValidPerformerName(performer.name),
});

// コアクエリ関数を取得
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

// セールクエリファクトリーを初期化
const saleQueries = createSaleQueries({
  getDb,
  products,
  productSources,
  productSales,
  productPerformers,
  performers,
  siteMode: 'all',
  getFromMemoryCache,
  setToMemoryCache,
});

// セールクエリ関数を取得
const { getSaleProducts: getSaleProductsShared, getSaleStats: getSaleStatsShared } = saleQueries;

// 女優クエリファクトリー（遅延初期化）
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
      mapPerformerToActress: (performer, locale) => mapPerformerToActressTypeSync(performer as DbPerformer, 0, undefined, undefined, undefined, locale),
      mapPerformerToActressAsync: (performer, locale) => mapPerformerToActressType(performer as DbPerformer, locale),
    });
  }
  return _actressQueries;
}

// 女優クエリ関数のラッパー（遅延初期化対応）
function getActressCareerAnalysisShared(actressId: string) {
  return getActressQueries().getActressCareerAnalysis(actressId);
}
function getActressAvgPricePerMinShared(actressId: string) {
  return getActressQueries().getActressAvgPricePerMin(actressId);
}
function getMultiAspActressesShared<T>(options?: { limit?: number; minAspCount?: number }) {
  return getActressQueries().getMultiAspActresses<T>(options);
}
function getActressesByAspShared<T>(options?: { aspName: string; limit?: number }) {
  return getActressQueries().getActressesByAsp<T>(options);
}

// 商品リストクエリファクトリーを初期化
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
  siteMode: 'all',
  batchFetchProductRelatedData: batchFetchProductRelatedDataShared,
  mapperDeps: {
    mapLegacyProvider,
    getProviderLabel,
    getLocalizedPerformerName,
    getLocalizedTagName,
    getLocalizedTitle,
    getLocalizedDescription,
    isValidPerformer: (performer: { name: string }) => isValidPerformerName(performer.name),
  },
  fetchProductRelatedData: fetchProductRelatedDataShared,
  mapProductToType: (product, performers, tagsData, source, cache, images, videos, locale) =>
    mapProductToType(product as DbProduct, performers, tagsData, source as SourceData, cache, images, videos, locale),
});

// 商品リストクエリ関数を取得
const {
  getProducts: getProductsShared,
  getProductsCount: getProductsCountShared,
  getProductsByCategory: getProductsByCategoryShared,
} = productListQueries;

// 女優リストクエリファクトリーを初期化
const actressListQueries = createActressListQueries({
  getDb,
  performers,
  performerAliases,
  productPerformers,
  productTags,
  productSources,
  productImages,
  productVideos,
  siteMode: 'all',
  enableActressFeatureFilter: false,
  mapPerformerToActress: (performer, productCount, thumbnail, services, aliases, locale) =>
    mapPerformerToActressTypeSync(performer as DbPerformer, productCount, thumbnail, services, aliases, locale),
  batchGetPerformerThumbnails,
  batchGetPerformerServices,
  batchGetPerformerAliases,
  getFromMemoryCache,
  setToMemoryCache,
});

// 女優リストクエリ関数を取得
const {
  getActresses: getActressesShared,
  getActressesCount: getActressesCountShared,
} = actressListQueries;

// 未整理商品クエリファクトリーを初期化
const uncategorizedQueries = createUncategorizedQueries({
  getDb,
  siteMode: 'all',
  fetchProductRelatedData: fetchProductRelatedDataShared,
  getFromMemoryCache,
  setToMemoryCache,
});

// 未整理商品クエリ関数を取得
const {
  getUncategorizedProducts: getUncategorizedProductsShared,
  getUncategorizedProductsCount: getUncategorizedProductsCountShared,
} = uncategorizedQueries;

// 商品クエリファクトリーを初期化
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
  siteMode: 'all', // FANZA除外
  mapProductToType,
  fetchProductRelatedData: fetchProductRelatedDataShared,
  isValidPerformer,
  generateProductIdVariations,
});

// 商品クエリ関数を取得
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

// Raw SQL query result row types (used for type annotations in raw queries)
interface _ProductRow {
  id: number;
  title: string | null;
  description: string | null;
  normalized_product_id: string | null;
  maker_product_code?: string | null;
  default_thumbnail_url: string | null;
  release_date: string | null;
  duration: number | null;
  title_en?: string | null;
  title_zh?: string | null;
  title_zh_tw?: string | null;
  title_ko?: string | null;
  description_en?: string | null;
  description_zh?: string | null;
  description_zh_tw?: string | null;
  description_ko?: string | null;
  // AI generated content
  ai_description?: string | null;
  ai_catchphrase?: string | null;
  ai_short_description?: string | null;
  ai_tags?: string[] | null;
  ai_review?: string | null;
  ai_review_updated_at?: Date | null;
  // Timestamps
  created_at?: Date | null;
  updated_at?: Date | null;
}

/**
 * 無効な演者データをフィルタリングするヘルパー関数
 * 共通関数isValidPerformerNameを使用
 */
function isValidPerformer(performer: { name: string }): boolean {
  return isValidPerformerName(performer.name);
}



// ============================================================
// 商品関連データのバッチ取得ヘルパー
// 型定義は @adult-v/shared からインポート
// ============================================================

// batchFetchProductRelatedData は @adult-v/shared の createCoreQueries から取得 (batchFetchProductRelatedDataShared)

/**
 * バッチ結果から商品を型変換するヘルパー関数
 * @param locale - ロケール（'ja' | 'en' | 'zh' | 'ko'）
 */
function _mapProductsWithBatchData(
  productList: DbProduct[],
  batchData: BatchRelatedDataResult,
  locale: string = 'ja'
): ProductType[] {
  return productList.map((product) => {
    const performerData = (batchData.performersMap.get(product.id) || []).filter(isValidPerformer);
    const tagData = batchData.tagsMap.get(product.id) || [];
    const imagesData = batchData.imagesMap.get(product.id);
    const videosData = batchData.videosMap.get(product.id);
    const saleData = batchData.salesMap.get(product.id);
    return mapProductToType(product, performerData, tagData, batchData.sourcesMap.get(product.id), undefined, imagesData, videosData, locale, saleData);
  });
}

// fetchProductRelatedData は @adult-v/shared の createCoreQueries から取得 (fetchProductRelatedDataShared)

/**
 * 商品をIDで取得
 * @param id - 商品ID
 * @param locale - ロケール（'ja' | 'en' | 'zh' | 'ko'）
 */
export async function getProductById(id: string, locale: string = 'ja'): Promise<ProductType | null> {
  return getProductByIdShared<ProductType>(id, locale);
}

/**
 * 商品を商品IDで検索（normalizedProductIdまたはoriginalProductId）
 * 品番のバリエーション（ハイフンあり/なし、大文字/小文字）にも対応
 * @param productId - 商品ID（正規化済みまたはオリジナル）
 * @param locale - ロケール（'ja' | 'en' | 'zh' | 'ko'）
 */
export async function searchProductByProductId(productId: string, locale: string = 'ja'): Promise<ProductType | null> {
  return searchProductByProductIdShared<ProductType>(productId, locale);
}

/**
 * 商品一覧を取得
 * 共有ファクトリーを使用
 */
export type SortOption = ProductSortOption;
export type GetProductsOptions = SharedGetProductsOptions;

export async function getProducts(options?: GetProductsOptions): Promise<ProductType[]> {
  return getProductsShared<ProductType>(options);
}

/**
 * 商品総数を取得（フィルターなし、キャッシュ付き）
 */
const getCachedTotalProductCount = unstable_cache(
  async () => {
    return getProductsCountShared();
  },
  ['total-product-count'],
  { revalidate: 300 } // 5分間キャッシュ
);

/**
 * 商品数を取得（フィルタ条件付き）
 * フィルターなしの場合はキャッシュを使用
 */
export async function getProductsCount(options?: Omit<GetProductsOptions, 'limit' | 'offset' | 'sortBy' | 'locale'>): Promise<number> {
  // フィルターなしの場合はキャッシュを使用
  const hasFilters = options && (
    options.query ||
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
    options.isFeatured
  );

  if (!hasFilters) {
    return getCachedTotalProductCount();
  }

  return getProductsCountShared(options);
}

/**
 * 女優IDで商品を取得
 * @param actressId - 女優ID
 * @param locale - ロケール（'ja' | 'en' | 'zh' | 'ko'）
 */
export async function getProductsByActress(actressId: string, locale: string = 'ja'): Promise<ProductType[]> {
  try {
    return await getProducts({ actressId, sortBy: 'releaseDateDesc', limit: 1000, locale });
  } catch (error) {
    console.error(`Error fetching products for actress ${actressId}:`, error);
    throw error;
  }
}

/**
 * 女優一覧を取得
 * 共通ファクトリーを使用
 */
export type { ActressSortOption };
export type GetActressesOptions = SharedGetActressesOptions;
export async function getActresses(options?: GetActressesOptions): Promise<ActressType[]> {
  return getActressesShared<ActressType>(options);
}

/**
 * バッチで複数女優の作品数を取得
 */
async function _batchGetPerformerProductCounts(db: ReturnType<typeof getDb>, performerIds: number[]): Promise<Map<number, number>> {
  if (performerIds.length === 0) return new Map();

  const results = await db
    .select({
      performerId: productPerformers.performerId,
      count: sql<number>`count(*)`,
    })
    .from(productPerformers)
    .where(inArray(productPerformers.performerId, performerIds))
    .groupBy(productPerformers.performerId);

  const map = new Map<number, number>();
  for (const r of results) {
    map.set(r.performerId, Number(r.count));
  }
  return map;
}

// batchGetPerformerThumbnails, batchGetPerformerServices, batchGetPerformerAliases は
// @adult-v/shared から createBatchPerformerQueries 経由でインポート済み（ファイル先頭参照）

/**
 * タグ一覧を取得（カテゴリ別） - シンプルなクエリ（JOINなし）
 * unstable_cacheでインスタンス間キャッシュを実現
 */
async function getTagsInternal(category?: string): Promise<Array<{ id: number; name: string; category: string | null }>> {
  try {
    const db = getDb();

    // タグ一覧のみ取得（JOINなし）
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

// unstable_cacheでラップ（カテゴリ別にキャッシュ）
const getCachedTags = createCachedFunction(
  getTagsInternal,
  ['tags'],
  ['tags'],
  CACHE_REVALIDATE_SECONDS
);

export async function getTags(category?: string): Promise<Array<{ id: number; name: string; category: string | null }>> {
  return getCachedTags(category);
}

/**
 * 女優の作品に絞ったタグ一覧を取得（カテゴリ別）
 */
export async function getTagsForActress(actressId: string, category?: string): Promise<Array<{ id: number; name: string; category: string | null }>> {
  try {
    const db = getDb();
    const performerId = parseInt(actressId);

    if (isNaN(performerId)) {
      return [];
    }

    // まず女優の作品IDを取得
    const actressProductIds = await db
      .selectDistinct({ productId: productPerformers.productId })
      .from(productPerformers)
      .where(eq(productPerformers.performerId, performerId));

    if (actressProductIds.length === 0) {
      return [];
    }

    const productIdList = actressProductIds.map(p => p.productId);

    // 女優の作品に含まれるタグを取得（件数カウントなし）
    const results = await db
      .selectDistinct({
        id: tags.id,
        name: tags.name,
        category: tags.category,
      })
      .from(tags)
      .innerJoin(productTags, eq(tags.id, productTags.tagId))
      .where(
        and(
          category ? eq(tags.category, category) : undefined,
          inArray(productTags.productId, productIdList)
        )
      )
      .orderBy(tags.name);

    return results;
  } catch (error) {
    console.error('Error fetching tags for actress:', error);
    throw error;
  }
}

/**
 * 女優の総数を取得
 * 共通ファクトリーを使用
 */
export type GetActressesCountOptions = SharedGetActressesCountOptions;
export async function getActressesCount(options?: GetActressesCountOptions): Promise<number> {
  return getActressesCountShared(options);
}

/**
 * 女優をIDで取得
 * @param id - 女優ID
 * @param locale - ロケール（'ja' | 'en' | 'zh' | 'ko'）
 */
export async function getActressById(id: string, locale: string = 'ja'): Promise<ActressType | null> {
  return getActressQueries().getActressById<ActressType>(id, locale);
}

/**
 * 女優の別名を取得
 */
export async function getPerformerAliases(performerId: number): Promise<Array<{
  id: number;
  aliasName: string;
  source: string | null;
  isPrimary: boolean | null;
  createdAt: Date;
}>> {
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

/**
 * 女優のサイト別作品数を取得
 */
export async function getActressProductCountBySite(actressId: string): Promise<Array<{
  siteName: string;
  count: number;
}>> {
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
      .where(and(
        eq(productPerformers.performerId, performerId),
        eq(tags.category, 'site')
      ))
      .groupBy(tags.name)
      .orderBy(desc(sql<number>`COUNT(DISTINCT ${products.id})`));

    return results.map(r => ({
      siteName: r.siteName,
      count: Number(r.count),
    }));
  } catch (error) {
    console.error(`Error fetching product count by site for actress ${actressId}:`, error);
    return [];
  }
}

/**
 * 女優のASP別作品数を取得（product_sourcesベース）
 */
export async function getActressProductCountByAsp(actressId: string): Promise<Array<{
  aspName: string;
  count: number;
}>> {
  try {
    const db = getDb();
    const performerId = parseInt(actressId);

    if (isNaN(performerId)) {
      return [];
    }

    // DTIはproductsテーブルのdefault_thumbnail_urlから個別サービス名を取得
    // affiliate_urlはclear-tv.comリダイレクトドメインのため使用不可
    const aspNormalizeSql = buildAspNormalizationSql('ps.asp_name', 'p.default_thumbnail_url');
    const results = await db.execute<{ asp_name: string; count: string }>(sql`
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
      .filter(r => r.asp_name !== null)
      .map(r => ({
        aspName: r.asp_name,
        count: parseInt(r.count, 10),
      }));
  } catch (error) {
    console.error(`Error fetching product count by ASP for actress ${actressId}:`, error);
    return [];
  }
}

/**
 * 新着商品を取得
 */
export async function getNewProducts(limit = 100): Promise<ProductType[]> {
  return getProducts({ isNew: true, sortBy: 'releaseDateDesc', limit });
}

/**
 * 注目商品を取得
 */
export async function getFeaturedProducts(limit = 100): Promise<ProductType[]> {
  return getProducts({ isFeatured: true, sortBy: 'releaseDateDesc', limit });
}

/**
 * 注目の女優を取得
 */
export async function getFeaturedActresses(limit = 3): Promise<ActressType[]> {
  try {
    return await getActresses({ limit });
  } catch (error) {
    console.error('Error fetching featured actresses:', error);
    throw error;
  }
}

/**
 * 商品の全ASPソース情報を取得（E-E-A-T強化用）
 */
export async function getProductSources(productId: number) {
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

/**
 * 商品の全ASPソース情報（セール情報付き）を取得
 * 価格比較機能用
 */
export async function getProductSourcesWithSales(productId: number) {
  try {
    const db = getDb();

    // Get all sources for this product (excluding FANZA - apps/web shows non-FANZA only)
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
      .where(and(
        eq(productSources.productId, productId),
        sql`LOWER(${productSources.aspName}) != 'fanza'`
      ));

    if (sources.length === 0) {
      return [];
    }

    // Get sale info for these sources
    const sourceIds = sources.map(s => s.id);
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
      .where(and(
        inArray(productSales.productSourceId, sourceIds),
        eq(productSales.isActive, true)
      ));

    // Create sale map
    const saleMap = new Map(sales.map(s => [s.productSourceId, s]));

    // Combine sources with sale info
    return sources.map(source => {
      const sale = saleMap.get(source.id);
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
    }).sort((a, b) => {
      // Sort by effective price (sale price or regular price)
      const priceA = a.salePrice ?? a.regularPrice ?? Infinity;
      const priceB = b.salePrice ?? b.regularPrice ?? Infinity;
      return priceA - priceB;
    });
  } catch (error) {
    console.error(`Error fetching product sources with sales for product ${productId}:`, error);
    return [];
  }
}

// SourceData は @adult-v/shared から MapperSourceData としてインポート

// Type for cache/stats data
interface CacheData {
  viewCount?: number;
  clickCount?: number;
  favoriteCount?: number;
  price?: number;
  thumbnailUrl?: string;
  affiliateUrl?: string;
  sampleImages?: string[];
}

// 商品マッパー依存関数
const productMapperDeps: ProductMapperDeps = {
  mapLegacyProvider,
  getProviderLabel,
  getLocalizedPerformerName,
  getLocalizedTagName,
  getLocalizedTitle,
  getLocalizedDescription,
};

/**
 * データベースの商品をProduct型に変換
 * 共通関数のラッパー
 * @param locale - ロケール（'ja' | 'en' | 'zh' | 'ko'）。指定された言語のタイトル/説明を使用
 */
function mapProductToType(
  product: DbProduct,
  performerData: Array<{ id: number; name: string; nameKana: string | null; nameEn?: string | null; nameZh?: string | null; nameKo?: string | null }> = [],
  tagData: Array<{ id: number; name: string; category: string | null; nameEn?: string | null; nameZh?: string | null; nameKo?: string | null }> = [],
  source?: SourceData | null,
  cache?: CacheData | null,
  imagesData?: Array<{ imageUrl: string; imageType: string; displayOrder: number | null }>,
  videosData?: Array<{ videoUrl: string; videoType: string | null; quality: string | null; duration: number | null }>,
  locale: string = 'ja',
  saleData?: { regularPrice: number; salePrice: number; discountPercent: number | null; endAt?: Date | null }
): ProductType {
  return mapProductToTypeBase(
    product,
    productMapperDeps,
    performerData,
    tagData,
    source,
    cache,
    imagesData,
    videosData,
    locale,
    saleData
  );
}

// マッパー依存関数（共通関数に渡す）
const mapperDeps = {
  getLocalizedPerformerName,
  getLocalizedPerformerBio,
  getLocalizedAiReview,
};

/**
 * データベースの出演者(performer)をActress型に変換（同期版）
 * 共通関数のラッパー
 */
function mapPerformerToActressTypeSync(performer: DbPerformer, releaseCount: number, thumbnailUrl?: string, services?: string[], aliases?: string[], locale: string = 'ja'): ActressType {
  return mapPerformerToActressTypeSyncBase(performer, releaseCount, mapperDeps, {
    thumbnailUrl,
    services,
    aliases,
    locale,
  });
}

/**
 * データベースの出演者(performer)をActress型に変換（非同期版 - 単一取得用）
 * @param locale - ロケール（'ja' | 'en' | 'zh' | 'ko'）
 */
async function mapPerformerToActressType(performer: DbPerformer, locale: string = 'ja'): Promise<ActressType> {
  const db = getDb();

  // 作品数、サムネイル、ASPサービスを並列取得
  const [productCountResult, thumbnailResult, servicesResult] = await Promise.all([
    // 作品数
    db.select({ count: sql<number>`count(*)` })
      .from(productPerformers)
      .where(eq(productPerformers.performerId, performer.id)),
    // サムネイル（DTI以外の商品を優先、なければDTIから取得）
    // FANZA専用商品は除外（webサイトでは表示禁止のため）
    db.select({ thumbnailUrl: products.defaultThumbnailUrl, aspName: productSources.aspName })
      .from(productPerformers)
      .innerJoin(products, eq(productPerformers.productId, products.id))
      .innerJoin(productSources, eq(productPerformers.productId, productSources.productId))
      .where(
        and(
          eq(productPerformers.performerId, performer.id),
          sql`${products.defaultThumbnailUrl} IS NOT NULL`,
          sql`${products.defaultThumbnailUrl} != ''`,
          // FANZA専用商品を除外: 他ASPソースが存在するか、FANZAソースが存在しない
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
          )`
        )
      )
      .orderBy(
        sql`CASE WHEN ${productSources.aspName} != 'DTI' THEN 0 ELSE 1 END`,
        desc(products.createdAt)
      )
      .limit(1),
    // ASPサービス一覧（DTIは個別サービスに分割）
    db.execute<{ asp_name: string }>(sql`
      SELECT DISTINCT
        ${sql.raw(buildAspNormalizationSql('ps.asp_name', 'p.default_thumbnail_url'))} as asp_name
      FROM product_performers pp
      INNER JOIN product_sources ps ON pp.product_id = ps.product_id
      INNER JOIN products p ON pp.product_id = p.id
      WHERE pp.performer_id = ${performer.id}
      AND ps.asp_name IS NOT NULL
    `),
  ]);

  const releaseCount = productCountResult[0]?.count || 0;
  const thumbnailUrl = thumbnailResult[0]?.thumbnailUrl;
  const services = (servicesResult.rows as { asp_name: string }[])
    .map(r => r.asp_name)
    .filter((s): s is string => s !== null && s !== '');

  return mapPerformerToActressTypeSync(performer, Number(releaseCount), thumbnailUrl ?? undefined, services, undefined, locale);
}

/**
 * 商品をあいまい検索（メーカー品番、タイトル、normalizedProductIdで検索）
 * 複数の商品が見つかる可能性があります
 */
export async function fuzzySearchProducts(query: string, limit: number = 20): Promise<ProductType[]> {
  return fuzzySearchProductsShared<ProductType>(query, limit, getProductById);
}

/**
 * 新作が出た女優を取得（最近リリースされた商品に出演している女優）
 */
export async function getActressesWithNewReleases(options: {
  limit?: number;
  daysAgo?: number; // 何日前までの新作を対象とするか（デフォルト: 30日）
  locale?: string;
} = {}): Promise<ActressType[]> {
  return getActressQueries().getActressesWithNewReleases<ActressType>({
    ...options,
    getActressByIdCallback: getActressById,
  });
}

/**
 * 人気タグ(作品数が多いタグ)を取得（キャッシュ付き）
 */
async function getPopularTagsUncached(options: {
  category?: string;
  limit?: number;
} = {}): Promise<Array<{ id: number; name: string; category: string | null; count: number }>> {
  try {
    const { category, limit = 20 } = options;
    const db = getDb();

    // タグとその作品数を取得
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

// キャッシュ化されたgetPopularTags（5分間キャッシュ）
const getCachedPopularTags = unstable_cache(
  async (category: string | undefined, limit: number) => {
    return getPopularTagsUncached({ category, limit });
  },
  ['popular-tags'],
  { revalidate: 300 } // 5分間キャッシュ
);

export async function getPopularTags(options: {
  category?: string;
  limit?: number;
} = {}): Promise<Array<{ id: number; name: string; category: string | null; count: number }>> {
  return getCachedPopularTags(options.category, options.limit ?? 20);
}

/**
 * 最新の商品を取得（RSS用）
 * @param options.locale - ロケール（'ja' | 'en' | 'zh' | 'ko'）
 */
export async function getRecentProducts(options?: {
  limit?: number;
  locale?: string;
}): Promise<ProductType[]> {
  return getRecentProductsShared<ProductType>(options);
}

/**
 * 出演者なし作品（未整理作品）を取得
 */
export async function getUncategorizedProducts(options?: UncategorizedProductsOptions): Promise<ProductType[]> {
  return getUncategorizedProductsShared<ProductType>(options);
}

/**
 * 出演者なし作品（未整理作品）の数を取得
 * 注: Adult-VサイトではFANZA専用商品を除外（規約によりadult-vサイトでは表示禁止）
 */
export async function getUncategorizedProductsCount(options?: UncategorizedProductsCountOptions): Promise<number> {
  return getUncategorizedProductsCountShared(options);
}

/**
 * マルチASP女優を取得（複数のサイトに出演している女優）
 * コンセプト: アフィリエイトサイトを横断して作品を探す
 */
export async function getMultiAspActresses(options: {
  limit?: number;
  minAspCount?: number;
} = {}): Promise<ActressType[]> {
  return getMultiAspActressesShared<ActressType>(options);
}

/**
 * ASP別人気女優を取得
 */
export async function getActressesByAsp(options: {
  aspName: string;
  limit?: number;
} = { aspName: 'DUGA' }): Promise<ActressType[]> {
  return getActressesByAspShared<ActressType>(options);
}

/**
 * プロバイダー（ASP）別商品数を取得（フィルター表示用）
 * providerMeta のIDをキーとした件数を返す
 */
export async function getProviderProductCounts(): Promise<Record<string, number>> {
  return getProviderProductCountsShared();
}

/**
 * ASP別商品数統計を取得 - 内部実装
 * DTIも含めて全ASPの統計を返す（UIレベルでフィルタリング可能）
 */
async function getAspStatsInternal(): Promise<Array<{ aspName: string; productCount: number; actressCount: number }>> {
  const db = getDb();

  // DTIはproductsテーブルのdefault_thumbnail_urlから個別サービス名を取得
  // affiliate_urlはclear-tv.comリダイレクトドメインのため使用不可
  const aspNormalizeSql = buildAspNormalizationSql('ps.asp_name', 'p.default_thumbnail_url');
  const result = await db.execute<{
    asp_name: string;
    product_count: string;
    actress_count: string;
  }>(sql`
    SELECT
      ${sql.raw(aspNormalizeSql)} as asp_name,
      COUNT(DISTINCT ps.product_id) as product_count,
      COUNT(DISTINCT pp.performer_id) as actress_count
    FROM product_sources ps
    LEFT JOIN products p ON ps.product_id = p.id
    LEFT JOIN product_performers pp ON ps.product_id = pp.product_id
    WHERE ps.asp_name IS NOT NULL
    GROUP BY ${sql.raw(aspNormalizeSql)}
    ORDER BY product_count DESC
  `);

  if (!result.rows) return [];

  // 同じ正規化名のエントリを統合（normalizeAspName関数を使用）
  const merged = new Map<string, { productCount: number; actressCount: number }>();
  for (const row of result.rows) {
    const normalized = normalizeAspName(row.asp_name);
    const existing = merged.get(normalized);
    if (existing) {
      existing.productCount += parseInt(row.product_count, 10);
      existing.actressCount += parseInt(row.actress_count, 10);
    } else {
      merged.set(normalized, {
        productCount: parseInt(row.product_count, 10),
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

/**
 * ASP別商品数統計を取得 - unstable_cacheでインスタンス間キャッシュ
 */
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
  CACHE_REVALIDATE_SECONDS
);

export async function getAspStats(): Promise<Array<{ aspName: string; productCount: number; actressCount: number }>> {
  return getCachedAspStats();
}

/**
 * ジャンル/カテゴリ一覧を取得（商品数付き）
 */
export { CategoryWithCount };

export async function getCategories(options?: {
  category?: string;
  sortBy?: 'productCount' | 'name';
  limit?: number;
}): Promise<CategoryWithCount[]> {
  return getCategoriesShared(options);
}

/**
 * 特定カテゴリの商品一覧を取得
 */
export async function getProductsByCategory(
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
  }
): Promise<ProductType[]> {
  return getProductsByCategoryShared<ProductType>(tagId, options);
}

/**
 * カテゴリ別の商品数を取得
 */
export async function getProductCountByCategory(
  tagId: number,
  options?: {
    initial?: string;
    includeAsp?: string[];
    excludeAsp?: string[];
    hasVideo?: boolean;
    hasImage?: boolean;
    performerType?: 'solo' | 'multi';
  }
): Promise<number> {
  return getProductCountByCategoryShared(tagId, options);
}

/**
 * カテゴリ別のASP統計を取得
 */
export async function getAspStatsByCategory(
  tagId: number
): Promise<Array<{ aspName: string; count: number }>> {
  return getAspStatsByCategoryShared(tagId);
}

/**
 * タグをIDで取得
 */
export async function getTagById(tagId: number): Promise<{
  id: number;
  name: string;
  nameEn: string | null;
  nameZh: string | null;
  nameKo: string | null;
  category: string | null;
} | null> {
  try {
    const db = getDb();
    const result = await db
      .select()
      .from(tags)
      .where(eq(tags.id, tagId))
      .limit(1);

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

/**
 * 未整理作品のASP別・品番パターン別統計
 */
export { UncategorizedStats };

export async function getUncategorizedStats(): Promise<UncategorizedStats> {
  return getUncategorizedStatsShared();
}

/**
 * wiki_crawl_dataから商品コードに対応する候補演者を取得
 */
export async function getCandidatePerformers(productCode: string): Promise<Array<{
  name: string;
  source: string;
}>> {
  return getCandidatePerformersShared(productCode);
}

// getSaleProducts は @adult-v/shared の createSaleQueries から取得 (getSaleProductsShared)
export const getSaleProducts = getSaleProductsShared;

/**
 * セール情報の統計を取得（共有版）
 */
export const getSaleStats = getSaleStatsShared;

/**
 * 女優の平均価格/分を取得（共有版）
 */
export const getActressAvgPricePerMin = getActressAvgPricePerMinShared;

/**
 * 女優のキャリア分析データを取得（共有版）
 */
export const getActressCareerAnalysis = getActressCareerAnalysisShared;

/**
 * ランダム作品の型定義
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
 * ランダムな作品を取得（発掘モード用）
 */
export async function getRandomProduct(options?: {
  excludeIds?: number[];
  tags?: string[];
  providers?: string[];
  locale?: string;
}): Promise<RandomProduct | null> {
  try {
    const db = getDb();
    const locale = options?.locale || 'ja';
    const conditions = [];

    // 除外ID
    if (options?.excludeIds && options.excludeIds.length > 0) {
      conditions.push(sql`p.id NOT IN ${options.excludeIds}`);
    }

    // タグフィルター
    if (options?.tags && options.tags.length > 0) {
      conditions.push(sql`EXISTS (
        SELECT 1 FROM product_tags pt
        JOIN tags t ON pt.tag_id = t.id
        WHERE pt.product_id = p.id AND t.id IN ${options.tags.map(t => parseInt(t))}
      )`);
    }

    // プロバイダーフィルター
    if (options?.providers && options.providers.length > 0) {
      conditions.push(sql`EXISTS (
        SELECT 1 FROM product_sources ps
        WHERE ps.product_id = p.id AND ps.asp_name IN ${options.providers}
      )`);
    }

    // サンプル画像がある作品のみ
    conditions.push(sql`p.sample_images IS NOT NULL AND jsonb_array_length(p.sample_images) > 0`);

    const whereClause = conditions.length > 0
      ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
      : sql`WHERE p.sample_images IS NOT NULL`;

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
      id: row.id as number,
      title: row.title as string,
      imageUrl: row.image_url as string,
      sampleImages: row.sample_images as string[] | null,
      releaseDate: row.release_date as string | null,
      duration: row.duration as number | null,
      price: row.price as number | null,
      provider: row.provider as string | null,
    };
  } catch (error) {
    console.error('Error fetching random product:', error);
    return null;
  }
}

/**
 * シリーズ情報を取得（シリーズ完走ガイド用）
 * seriesタイプのタグからシリーズを特定し、関連作品を取得
 */
export type { SeriesBasicInfo } from '@adult-v/shared';

export async function getSeriesByTagId(tagId: number, locale: string = 'ja') {
  return getSeriesByTagIdShared(tagId, locale);
}

/**
 * メーカー/レーベル情報を取得
 */
export type MakerInfo = SharedMakerInfo;

export async function getMakerById(makerId: number, locale: string = 'ja'): Promise<MakerInfo | null> {
  return getMakerByIdShared(makerId, locale);
}

/**
 * 人気メーカー/レーベル一覧を取得
 */
export async function getPopularMakers(options?: {
  category?: 'maker' | 'label' | 'both';
  limit?: number;
  locale?: string;
}): Promise<PopularMaker[]> {
  return getPopularMakersShared(options);
}

/**
 * 女優が高評価した作品のメーカー傾向を分析
 * ユーザーのお気に入り作品からメーカー傾向を分析
 */
export async function analyzeMakerPreference(productIds: number[], locale: string = 'ja'): Promise<MakerPreference[]> {
  return analyzeMakerPreferenceShared(productIds, locale);
}

/**
 * シリーズ情報を取得（シリーズ完走ガイド用）
 */
export interface SeriesInfo extends SharedSeriesInfo {
  products?: SeriesProduct[];
}

export async function getSeriesInfo(seriesTagId: number): Promise<SeriesInfo | null> {
  return getSeriesInfoShared(seriesTagId);
}

/**
 * シリーズ内の作品リストを取得（完走ガイド用）
 */
export async function getSeriesProducts(
  seriesTagId: number,
  options?: {
    sortBy?: 'releaseDateAsc' | 'releaseDateDesc' | 'ratingDesc';
    locale?: string;
  }
) {
  return getSeriesProductsShared(seriesTagId, options);
}

/**
 * 人気シリーズ一覧を取得
 */
export async function getPopularSeries(limit: number = 20): Promise<PopularSeries[]> {
  return getPopularSeriesShared(limit);
}

/**
 * 品番(maker_product_code)で同じ作品の全ASPソース情報（セール情報付き）を取得
 * 複数のproduct_idにまたがるソースを統合
 * 品番のバリエーション（ハイフンあり/なし、大文字/小文字など）も検索
 */
export async function getProductSourcesByMakerCode(makerProductCode: string) {
  if (!makerProductCode) return [];

  try {
    const db = getDb();

    // 正規化した品番でLIKE検索するパターンを作成
    // ハイフン・アンダースコアを除去し、小文字化した検索キー
    const normalizedCode = makerProductCode.toLowerCase().replace(/[-_]/g, '');

    // 同じ品番を持つ全商品のソースを取得（正規化した品番で一致検索）
    const result = await db.execute<{
      id: number;
      product_id: number;
      asp_name: string;
      original_product_id: string;
      price: number | null;
      currency: string | null;
      affiliate_url: string;
      is_subscription: boolean | null;
      product_type: string | null;
      regular_price: number | null;
      sale_price: number | null;
      discount_percent: number | null;
      end_at: Date | null;
      is_active: boolean | null;
    }>(sql`
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
      LEFT JOIN product_sales psa ON psa.product_source_id = ps.id AND psa.is_active = true
      WHERE LOWER(REPLACE(REPLACE(p.maker_product_code, '-', ''), '_', '')) = ${normalizedCode}
        AND LOWER(ps.asp_name) != 'fanza'
      ORDER BY ps.asp_name, COALESCE(psa.sale_price, ps.price) ASC NULLS LAST
    `);

    return (result.rows || []).map((row) => ({
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

/**
 * タイトルベースで同じ作品の全ASPソース情報（セール情報付き）を取得
 * タイトルを正規化して同じ作品を識別
 */
export async function getProductSourcesByTitle(productId: number, title: string) {
  if (!title) return [];

  try {
    const db = getDb();

    // タイトルを正規化してLIKE検索用パターンを作成
    // 空白・記号を除去した正規化タイトルで類似商品を検索
    const normalizedTitle = title
      .replace(/[\s　]+/g, '') // スペース除去
      .replace(/[！!？?「」『』【】（）()＆&～~・:：,，。.、]/g, ''); // 記号除去

    // 同じ正規化タイトルを持つ全商品のソースを取得
    const result = await db.execute<{
      id: number;
      product_id: number;
      asp_name: string;
      original_product_id: string;
      price: number | null;
      currency: string | null;
      affiliate_url: string;
      is_subscription: boolean | null;
      product_type: string | null;
      regular_price: number | null;
      sale_price: number | null;
      discount_percent: number | null;
      end_at: Date | null;
      is_active: boolean | null;
    }>(sql`
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
      LEFT JOIN product_sales psa ON psa.product_source_id = ps.id AND psa.is_active = true
      WHERE LOWER(REGEXP_REPLACE(REGEXP_REPLACE(p.title, '[[:space:]　]+', '', 'g'), '[！!？?「」『』【】（）()＆&～~・:：,，。.、]', '', 'g')) = LOWER(${normalizedTitle})
        AND LOWER(ps.asp_name) != 'fanza'
      ORDER BY ps.asp_name, COALESCE(psa.sale_price, ps.price) ASC NULLS LAST
    `);

    return (result.rows || []).map((row) => ({
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

/**
 * 品番(maker_product_code)で同じ作品の全ASPからサンプル画像を取得
 */
export async function getSampleImagesByMakerCode(makerProductCode: string) {
  return getSampleImagesByMakerCodeShared(makerProductCode, {
    includeImageType: true,
    filterImageTypes: ['sample', 'screenshot'],
    limit: 50,
  });
}

/**
 * 商品の品番(maker_product_code)を取得
 */
export async function getProductMakerCode(productId: number): Promise<string | null> {
  try {
    const db = getDb();
    const result = await db.execute<{ maker_product_code: string | null }>(sql`
      SELECT maker_product_code FROM products WHERE id = ${productId}
    `);
    return result.rows?.[0]?.maker_product_code ?? null;
  } catch (error) {
    console.error(`Error fetching maker code for product ${productId}:`, error);
    return null;
  }
}

/**
 * ソース情報の型定義
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
 * 商品の全ASPソース情報を統合取得
 * 品番ベース + タイトルベース + 商品IDベースで検索し、ASP名で重複排除
 * 品番ベースの結果を優先
 */
export async function getAllProductSources(
  productId: number,
  title: string,
  makerProductCode: string | null
): Promise<ProductSourceWithSales[]> {
  // 並列で全検索を実行
  const [codeBasedSources, titleBasedSources, productIdSources] = await Promise.all([
    makerProductCode ? getProductSourcesByMakerCode(makerProductCode) : Promise.resolve([]),
    getProductSourcesByTitle(productId, title),
    getProductSourcesWithSales(productId),
  ]);

  // ASP名で重複排除しながらマージ（品番ベース優先）
  const sourceMap = new Map<string, ProductSourceWithSales>();
  for (const source of [...productIdSources, ...titleBasedSources, ...codeBasedSources]) {
    // 後から追加されたものが優先（品番ベースが最優先）
    sourceMap.set(source.aspName, source);
  }

  // 価格でソート（安い順）
  return Array.from(sourceMap.values()).sort((a, b) => {
    const priceA = a.salePrice ?? a.regularPrice ?? Infinity;
    const priceB = b.salePrice ?? b.regularPrice ?? Infinity;
    return priceA - priceB;
  });
}

