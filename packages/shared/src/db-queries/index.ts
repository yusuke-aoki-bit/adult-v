/**
 * 共有DBクエリ
 */
export {
  createRecommendationsQueries,
  type RecommendationsDeps,
  type RecommendationsQueries,
  type RelatedProductResult,
  type WeeklyHighlights,
  type ViewingPatternStats,
  type RecommendedActress,
  type RelatedPerformer,
  type RelatedPerformerWithGenre,
  type SimilarActress,
  type TopRatedProduct,
  type PerformerOnSaleProduct,
} from './recommendations';

export {
  createWikiPerformerSearchQueries,
  type WikiPerformerSearchDeps,
  type WikiPerformerSearchQueries,
  type WikiPerformerSearchResult,
} from './wiki-performer-search';

export {
  createSaleHelperQueries,
  createSaleQueries,
  type SaleHelperDeps,
  type SaleHelperQueries,
  type SaleQueryDeps,
  type SaleQueryQueries,
  type SaleInfo,
  type SaleProduct,
  type SaleStatsWithAspResult,
} from './sale-helper';

export {
  createProductQueries,
  type ProductQueryDeps,
  type ProductQueries,
  type ProductSourceResult,
  type ProductSourceWithSaleResult,
} from './product-queries';

export {
  createProductListQueries,
  type ProductListQueryDeps,
  type ProductListQueries,
  type GetProductsByCategoryOptions,
} from './product-list-queries';

export {
  createActressQueries,
  type ActressQueryDeps,
  type ActressQueries,
  type PerformerAlias,
  type SiteProductCount,
  type AspProductCount,
  type CareerAnalysis,
} from './actress-queries';

export {
  createActressListQueries,
  type ActressListQueryDeps,
  type ActressListQueries,
  type ActressSortOption,
  type GetActressesOptions,
  type GetActressesCountOptions,
} from './actress-list-queries';

export {
  createAspFilterCondition,
  createProviderFilterCondition,
  createMultiProviderFilterCondition,
  createExcludeProviderFilterCondition,
  createActressAspFilterCondition,
  PROVIDER_TO_ASP_MAPPING,
  type SiteMode,
} from './asp-filter';

export {
  createCoreQueries,
  type CoreQueryDeps,
  type CoreQueries,
  type TagResult,
  type ProviderProductCount,
  type SaleStatsResult,
  type ProductRelatedData,
  type BatchRelatedDataResult,
  type BatchPerformerData,
  type BatchTagData,
  type BatchImageData,
  type BatchVideoData,
  type BatchSaleData,
  type CategoryWithCount,
  type UncategorizedStats,
  type SeriesInfo,
  type PopularSeries,
  type PopularMaker,
  type MakerPreference,
  type MakerInfo,
  type SeriesBasicInfo,
  type SeriesProduct,
} from './core-queries';

export {
  mapPerformerToActressTypeSync,
  mapProductToType,
  mapProductsWithBatchData,
  type DbPerformer,
  type MapperDeps,
  type DbProduct,
  type ProductMapperDeps,
  type MapProductsWithBatchDataDeps,
  type SourceData as MapperSourceData,
  type CacheData as MapperCacheData,
  type ImageData,
  type VideoData,
  type SaleData,
  type PerformerData as MapperPerformerData,
  type TagData as MapperTagData,
} from './mappers';

export {
  createBatchPerformerQueries,
  type BatchPerformerQueryDeps,
  type BatchPerformerQueries,
} from './batch-performer-queries';

export {
  getMonthlyReleaseStats,
  getTopPerformersByProductCount,
  getTopGenres,
  getAspDistribution,
  getYearlyStats,
  getOverallStats,
  getCurrentMonthReleases,
  getNewPerformersThisYear,
  getMakerShareStats,
  getGenreTrends,
  getDebutTrends,
  getDailyReleases,
  getCalendarDetailData,
  type MonthlyReleaseStats,
  type TopPerformer,
  type GenreStats,
  type AspStats,
  type YearlyStats,
  type OverallStats,
  type MakerStats,
  type GenreTrend,
  type DebutStats,
  type DailyRelease,
  type CalendarProduct,
  type CalendarPerformer,
  type CalendarDayData,
} from './stats-queries';

export {
  createUncategorizedQueries,
  type UncategorizedQueryDeps,
  type UncategorizedQueries,
  type UncategorizedProductsOptions,
  type UncategorizedProductsCountOptions,
} from './uncategorized-queries';

export {
  createPriceHistoryQueries,
  type PriceHistoryEntry,
  type PriceHistoryWithAsp,
  type PriceStats,
} from './price-history';

// 型定義
export type {
  Column,
  ProductsTableColumns,
  ProductSourcesTableColumns,
  PerformersTableColumns,
  TagsTableColumns,
  ProductPerformersTableColumns,
  ProductTagsTableColumns,
  ProductImagesTableColumns,
  ProductVideosTableColumns,
  ProductSalesTableColumns,
  TableReference,
  ProductsTable,
  ProductSourcesTable,
  PerformersTable,
  TagsTable,
  ProductPerformersTable,
  ProductTagsTable,
  ProductImagesTable,
  ProductVideosTable,
  ProductSalesTable,
  DbConnection,
  PaginatedResult,
  PaginationOptions,
  SortOptions,
  FilterOptions,
  // サイトモード関連型
  SourceData,
  PerformerData,
  TagData,
  CacheData,
  RawProductRow,
  ProductRow,
  FanzaFilterConfig,
  ProductQueryOptions,
  // getProducts用型定義
  ProductSortOption,
  GetProductsOptions,
} from './types';
