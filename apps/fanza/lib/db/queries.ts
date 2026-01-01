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
  siteMode: 'fanza-only',
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
  siteMode: 'fanza-only',
  getFromMemoryCache,
  setToMemoryCache,
});

// セールクエリ関数を取得
const { getSaleProducts: getSaleProductsShared, getSaleStats: getSaleStatsShared } = saleQueries;

// 女優クエリファクトリー（遅延初期化）
let _actressQueries: ReturnType<typeof createActressQueries> | null = null;
function getActressQueriesFactory() {
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
  return getActressQueriesFactory().getActressCareerAnalysis(actressId);
}
function getActressAvgPricePerMinShared(actressId: string) {
  return getActressQueriesFactory().getActressAvgPricePerMin(actressId);
}
function getMultiAspActressesShared<T>(options?: { limit?: number; minAspCount?: number }) {
  return getActressQueriesFactory().getMultiAspActresses<T>(options);
}
function getActressesByAspShared<T>(options?: { aspName: string; limit?: number }) {
  return getActressQueriesFactory().getActressesByAsp<T>(options);
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
  siteMode: 'fanza-only',
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
  mapProductToType: (product, performersData, tagsData, source, cache, images, videos, locale) =>
    mapProductToType(
      product as DbProduct,
      performersData as { id: number; name: string; nameKana: string | null }[],
      tagsData as { id: number; name: string; category: string | null }[],
      source as SourceData,
      cache as CacheData | undefined,
      images as { productId: number; imageUrl: string; imageType: string; displayOrder: number | null }[],
      videos as { productId: number; videoUrl: string; videoType: string | null; quality: string | null; duration: number | null }[],
      locale
    ),
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
  siteMode: 'fanza-only',
  enableActressFeatureFilter: true,
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
  siteMode: 'fanza-only',
  fetchProductRelatedData: fetchProductRelatedDataShared,
  getFromMemoryCache,
  setToMemoryCache,
});

// 未整理商品クエリ関数を取得
const {
  getUncategorizedProducts: getUncategorizedProductsShared,
  getUncategorizedProductsCount: getUncategorizedProductsCountShared,
} = uncategorizedQueries;

// SourceData は @adult-v/shared から MapperSourceData としてインポート

interface CacheData {
  price?: number;
  thumbnailUrl?: string;
  affiliateUrl?: string;
  sampleImages?: string[];
}

// Raw product row from SQL query (for type reference in raw queries)
interface _RawProductRow {
  id: number;
  title: string | null;
  title_en?: string | null;
  title_zh?: string | null;
  title_zh_tw?: string | null;
  title_ko?: string | null;
  description?: string | null;
  description_en?: string | null;
  description_zh?: string | null;
  description_zh_tw?: string | null;
  description_ko?: string | null;
  normalized_product_id?: string | null;
  maker_product_code?: string | null;
  default_thumbnail_url?: string | null;
  release_date?: Date | null;
  duration?: number | null;
  ai_description?: string | null;
  ai_catchphrase?: string | null;
  ai_short_description?: string | null;
  ai_tags?: string | null;
  ai_review?: string | null;
  ai_review_updated_at?: Date | null;
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
  return getProductQueries().getProductById<ProductType>(id, locale);
}

/**
 * 商品を商品IDで検索（normalizedProductIdまたはoriginalProductId）
 * 品番のバリエーション（ハイフンあり/なし、大文字/小文字）にも対応
 * @param productId - 商品ID（正規化済みまたはオリジナル）
 * @param locale - ロケール（'ja' | 'en' | 'zh' | 'ko'）
 */
export async function searchProductByProductId(productId: string, locale: string = 'ja'): Promise<ProductType | null> {
  return getProductQueries().searchProductByProductId<ProductType>(productId, locale);
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
  ['fanza-total-product-count'],
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
 * 注: FANZAサイトではFANZA商品のみをカウント（規約により他ASP商品は表示禁止）
 */
async function _batchGetPerformerProductCounts(db: ReturnType<typeof getDb>, performerIds: number[]): Promise<Map<number, number>> {
  if (performerIds.length === 0) return new Map();

  // FANZAサイトではFANZA商品のみをカウント
  const results = await db.execute<{ performer_id: number; count: string }>(sql`
    SELECT
      pp.performer_id,
      COUNT(*) as count
    FROM product_performers pp
    INNER JOIN product_sources ps ON pp.product_id = ps.product_id
    WHERE pp.performer_id IN (${sql.join(performerIds.map(id => sql`${id}`), sql`, `)})
      AND ps.asp_name = 'FANZA'
    GROUP BY pp.performer_id
  `);

  const map = new Map<number, number>();
  for (const r of results.rows) {
    map.set(r.performer_id, Number(r.count));
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
  ['tags-fanza'],
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
  return getActressQueriesFactory().getActressById<ActressType>(id, locale);
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
  source?: SourceData,
  cache?: CacheData,
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
    db.select({ thumbnailUrl: products.defaultThumbnailUrl, aspName: productSources.aspName })
      .from(productPerformers)
      .innerJoin(products, eq(productPerformers.productId, products.id))
      .innerJoin(productSources, eq(productPerformers.productId, productSources.productId))
      .where(
        and(
          eq(productPerformers.performerId, performer.id),
          sql`${products.defaultThumbnailUrl} IS NOT NULL`,
          sql`${products.defaultThumbnailUrl} != ''`
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

// 商品クエリファクトリー（遅延初期化）
let _productQueries: ReturnType<typeof createProductQueries> | null = null;
function getProductQueries() {
  if (!_productQueries) {
    _productQueries = createProductQueries({
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
      mapProductToType: (product, performers, tags, source, cache, images, videos, locale, saleData) =>
        mapProductToType(
          product as DbProduct,
          performers as { id: number; name: string; nameKana: string | null }[],
          tags as { id: number; name: string; category: string | null }[],
          source as SourceData,
          cache as CacheData | undefined,
          images as { imageUrl: string; imageType: string; displayOrder: number | null }[],
          videos as { videoUrl: string; videoType: string | null; quality: string | null; duration: number | null }[],
          locale,
          saleData
        ),
      fetchProductRelatedData: fetchProductRelatedDataShared,
      isValidPerformer,
      generateProductIdVariations,
    });
  }
  return _productQueries;
}

/**
 * 商品をあいまい検索（メーカー品番、タイトル、normalizedProductIdで検索）
 * 複数の商品が見つかる可能性があります
 */
export async function fuzzySearchProducts(query: string, limit: number = 20): Promise<ProductType[]> {
  return getProductQueries().fuzzySearchProducts<ProductType>(query, limit, getProductById);
}

/**
 * 新作が出た女優を取得（最近リリースされた商品に出演している女優）
 */
export async function getActressesWithNewReleases(options: {
  limit?: number;
  daysAgo?: number; // 何日前までの新作を対象とするか（デフォルト: 30日）
  locale?: string;
} = {}): Promise<ActressType[]> {
  return getActressQueriesFactory().getActressesWithNewReleases<ActressType>({
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

    // タグとその作品数を取得（タイムアウト対策: シンプルなクエリに変更）
    // product_tagsのJOINは重いので、tagsテーブルのみ取得してcountは0で返す
    // 本番環境では定期的にキャッシュを更新するか、別途集計テーブルを用意
    const result = await db
      .select({
        id: tags.id,
        name: tags.name,
        category: tags.category,
      })
      .from(tags)
      .where(category ? eq(tags.category, category) : undefined)
      .orderBy(tags.name)
      .limit(limit);

    return result.map(tag => ({ ...tag, count: 0 }));
  } catch (error) {
    console.error('Error getting popular tags:', error);
    // タイムアウトエラーの場合は空配列を返す
    return [];
  }
}

// キャッシュ化されたgetPopularTags（5分間キャッシュ）
const getCachedPopularTags = unstable_cache(
  async (category: string | undefined, limit: number) => {
    return getPopularTagsUncached({ category, limit });
  },
  ['fanza-popular-tags'],
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
  return getProductQueries().getRecentProducts<ProductType>(options);
}

/**
 * 出演者なし作品（未整理作品）を取得
 */
export async function getUncategorizedProducts(options?: UncategorizedProductsOptions): Promise<ProductType[]> {
  return getUncategorizedProductsShared<ProductType>(options);
}

/**
 * 出演者なし作品（未整理作品）の数を取得
 * 注: FANZAサイトではFANZA商品のみを表示（規約により他ASP商品は表示禁止）
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
  ['aspStats-fanza'],
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
 * 注: FANZAサイトではFANZA商品のみを表示（規約により他ASP商品は表示禁止）
 */
export const getSaleStats = getSaleStatsShared;

/**
 * 女優のキャリア分析データを取得（共有版）
 */
export const getActressCareerAnalysis = getActressCareerAnalysisShared;

/**
 * シリーズ内の作品の型定義
 */
/**
 * シリーズ作品の型定義
 */
export type { SeriesProduct } from '@adult-v/shared';

/**
 * シリーズ情報を取得（シリーズ完走ガイド用）
 */
export type SeriesInfo = SharedSeriesInfo;

export async function getSeriesInfo(seriesTagId: number): Promise<SeriesInfo | null> {
  return getSeriesInfoShared(seriesTagId);
}

/**
 * シリーズ内の作品リストを取得
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
 * ユーザーのお気に入り作品からメーカー傾向を分析
 */
export async function analyzeMakerPreference(productIds: number[], locale: string = 'ja'): Promise<MakerPreference[]> {
  return analyzeMakerPreferenceShared(productIds, locale);
}

/**
 * メーカー/レーベル詳細情報
 */
export type MakerInfo = SharedMakerInfo;

export async function getMakerById(makerId: number, locale: string = 'ja'): Promise<MakerInfo | null> {
  return getMakerByIdShared(makerId, locale);
}

/**
 * 商品ソースとセール情報を取得
 */
export async function getProductSourcesWithSales(productId: number) {
  try {
    const db = getDb();

    // Get all sources for this product
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
      .where(eq(productSources.productId, productId));

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
        startAt: productSales.startAt,
        endAt: productSales.endAt,
      })
      .from(productSales)
      .where(inArray(productSales.productSourceId, sourceIds));

    // Create a map for quick lookup
    const saleMap = new Map(sales.map(s => [s.productSourceId, s]));

    // Combine sources with sales
    return sources.map(source => ({
      ...source,
      sale: saleMap.get(source.id) || null,
    }));
  } catch (error) {
    console.error(`Error fetching product sources with sales for ${productId}:`, error);
    return [];
  }
}

/**
 * 女優の平均分単価を取得（共有版）
 */
export const getActressAvgPricePerMin = getActressAvgPricePerMinShared;

/**
 * seriesタイプのタグからシリーズを特定し、関連作品を取得
 */
export type { SeriesBasicInfo } from '@adult-v/shared';

export async function getSeriesByTagId(tagId: number, locale: string = 'ja') {
  return getSeriesByTagIdShared(tagId, locale);
}

/**
 * 品番（maker_product_code）から全ASPのソース情報をセール情報付きで取得
 * 名寄せ用: 同じ品番を持つ異なるproduct_idの商品を統合
 */
export async function getProductSourcesByMakerCode(makerProductCode: string) {
  try {
    const db = getDb();

    // 同じ品番を持つ全商品のIDを取得
    const productIds = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.makerProductCode, makerProductCode));

    if (productIds.length === 0) {
      return [];
    }

    const ids = productIds.map(p => p.id);

    // 全商品のソース情報を取得（FANZAのみ）
    const sources = await db
      .select({
        id: productSources.id,
        productId: productSources.productId,
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
        inArray(productSources.productId, ids),
        sql`LOWER(${productSources.aspName}) = 'fanza'`
      ));

    if (sources.length === 0) {
      return [];
    }

    // セール情報を取得
    const sourceIds = sources.map(s => s.id);
    const sales = await db
      .select({
        productSourceId: productSales.productSourceId,
        regularPrice: productSales.regularPrice,
        salePrice: productSales.salePrice,
        discountPercent: productSales.discountPercent,
        startAt: productSales.startAt,
        endAt: productSales.endAt,
      })
      .from(productSales)
      .where(inArray(productSales.productSourceId, sourceIds));

    const saleMap = new Map(sales.map(s => [s.productSourceId, s]));

    // ASP名でユニーク化（同じASPが複数ある場合は最初の1つを使用）
    const uniqueByAsp = new Map<string, typeof sources[0] & { sale: typeof sales[0] | null }>();
    for (const source of sources) {
      if (!uniqueByAsp.has(source.aspName)) {
        uniqueByAsp.set(source.aspName, {
          ...source,
          sale: saleMap.get(source.id) || null,
        });
      }
    }

    return Array.from(uniqueByAsp.values());
  } catch (error) {
    console.error(`Error fetching product sources by maker code ${makerProductCode}:`, error);
    return [];
  }
}

/**
 * 品番（maker_product_code）から全ASPのサンプル画像を取得
 * 名寄せ用: 異なるASPのサンプル画像を統合して返す
 */
export async function getSampleImagesByMakerCode(makerProductCode: string) {
  return getProductQueries().getSampleImagesByMakerCode(makerProductCode);
}

/**
 * 商品IDから品番（maker_product_code）を取得
 */
export async function getProductMakerCode(productId: number): Promise<string | null> {
  try {
    const db = getDb();
    const result = await db
      .select({ makerProductCode: products.makerProductCode })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    return result[0]?.makerProductCode || null;
  } catch (error) {
    console.error(`Error fetching maker code for product ${productId}:`, error);
    return null;
  }
}

