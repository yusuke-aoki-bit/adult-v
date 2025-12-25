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
  type SaleHelperDeps,
  type SaleHelperQueries,
  type SaleInfo,
} from './sale-helper';

export {
  createProductQueries,
  type ProductQueryDeps,
  type ProductQueries,
  type ProductSourceResult,
  type ProductSourceWithSaleResult,
} from './product-queries';

export {
  createActressQueries,
  type ActressQueryDeps,
  type ActressQueries,
  type PerformerAlias,
  type SiteProductCount,
  type AspProductCount,
} from './actress-queries';

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
} from './core-queries';

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
  FanzaFilterConfig,
  ProductQueryOptions,
} from './types';
