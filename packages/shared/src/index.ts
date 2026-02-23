// @adult-v/shared package exports

// Types
export * from './types/index';

// Contexts
export * from './contexts';

// Providers
export * from './providers';
export * from './provider-utils';

// Constants
export * from './constants/index';

// Utilities
export * from './localization';
export * from './image-utils';
export * from './site-config';

// Prompts
export * from './prompts/review-templates';

// Product ID utilities
export * from './lib/product-id-utils';

// ASP utilities
export * from './lib/asp-utils';

// Deduplication utilities
export {
  normalizeTitle,
  deduplicateProductsByTitle,
  type AlternativeSource,
  type DeduplicatableProduct,
} from './lib/deduplication';

// Source selection utilities
export {
  selectProductSources,
  groupSourcesByProduct,
  type ProductSourceData,
  type SourceSelectionOptions,
  type SourceSelectionResult,
} from './lib/source-selection';

// Performer validation utilities
export {
  isValidPerformerName,
  normalizePerformerName,
  parsePerformerNames,
  isValidPerformerForProduct,
} from './lib/performer-validation';

// DB Query utilities (ASP filters)
export {
  createAspFilterCondition,
  createProviderFilterCondition,
  createMultiProviderFilterCondition,
  createExcludeProviderFilterCondition,
  createActressAspFilterCondition,
  PROVIDER_TO_ASP_MAPPING,
  type SiteMode,
} from './db-queries/asp-filter';

// DB Query utilities (Mappers)
export {
  mapPerformerToActressTypeSync,
  mapProductToType,
  type DbPerformer,
  type MapperDeps,
  type DbProduct,
  type ProductMapperDeps,
  type SourceData as MapperSourceData,
  type CacheData as MapperCacheData,
  type ImageData,
  type VideoData,
  type SaleData,
  type PerformerData as MapperPerformerData,
  type TagData as MapperTagData,
} from './db-queries/mappers';

// DB Query utilities (Batch Performer Queries)
export {
  createBatchPerformerQueries,
  type BatchPerformerQueryDeps,
  type BatchPerformerQueries,
} from './db-queries/batch-performer-queries';

// DB Query utilities (Core Queries)
export {
  createCoreQueries,
  type CoreQueryDeps,
  type CoreQueries,
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
} from './db-queries/core-queries';

// DB Query utilities (Sale Queries)
export {
  createSaleQueries,
  type SaleQueryDeps,
  type SaleQueryQueries,
  type SaleProduct,
  type SaleStatsWithAspResult,
} from './db-queries/sale-helper';

// DB Query utilities (Actress Queries)
export {
  createActressQueries,
  type ActressQueryDeps,
  type ActressQueries,
  type CareerAnalysis,
} from './db-queries/actress-queries';

// DB Query utilities (Product List Queries)
export {
  createProductListQueries,
  type ProductListQueryDeps,
  type ProductListQueries,
} from './db-queries/product-list-queries';

// DB Query utilities (Product Queries)
export {
  createProductQueries,
  type ProductQueryDeps,
  type ProductQueries,
  type ProductSourceResult,
  type ProductSourceWithSaleResult,
} from './db-queries/product-queries';

// DB Query utilities (Actress List Queries)
export {
  createActressListQueries,
  type ActressListQueryDeps,
  type ActressListQueries,
  type ActressSortOption,
  type GetActressesOptions,
  type GetActressesCountOptions,
} from './db-queries/actress-list-queries';

// DB Query utilities (Uncategorized Queries)
export {
  createUncategorizedQueries,
  type UncategorizedQueryDeps,
  type UncategorizedQueries,
  type UncategorizedProductsOptions,
  type UncategorizedProductsCountOptions,
} from './db-queries/uncategorized-queries';

// Cache utilities
export {
  CACHE_CONFIG,
  getMemoryCache,
  getFromMemoryCache,
  setToMemoryCache,
  clearLegacyMemoryCache,
  createCacheKey,
  createCacheKeyParts,
  CACHE_TAGS,
  withMemoryCache,
  CACHE_TTL_MS,
  CACHE_REVALIDATE_SECONDS,
  type CachedFunctionOptions,
} from './lib/cache-utils';

// DB Query utilities (App Queries Factory)
export {
  createAppQueries,
  type CreateAppQueriesDeps,
  type AppQueries,
  type CacheData as AppCacheData,
  type RandomProduct,
  type ProductSourceWithSales,
  type SeriesInfo as AppSeriesInfo,
} from './db-queries/create-app-queries';

// DB Query types
export type { RawProductRow, ProductRow, ProductSortOption, GetProductsOptions } from './db-queries/types';

// LLM Service
export {
  LLMService,
  analyzeSearchQuery,
  generateProductDescription,
  generateRecommendationExplanation,
  generateActressProfile,
  generateChatResponse,
  type SearchQueryAnalysis,
  type GeneratedProductDescription,
  type RecommendationExplanation,
  type GeneratedActressProfile,
  type ChatResponse,
} from './lib/llm-service';

// Embedding Service (for semantic search)
export {
  generateEmbedding,
  generateEmbeddingBatch,
  generateQueryEmbedding,
  buildProductEmbeddingText,
  buildPerformerEmbeddingText,
  generateTextHash,
  cosineSimilarity,
  type EmbeddingResult,
  type BatchEmbeddingResult,
} from './lib/embedding-service';

// API Validation Schemas (Zod)
export {
  paginationSchema,
  idSchema,
  searchQuerySchema,
  priceRangeSchema,
  sortOrderSchema,
  localeSchema,
  productListParamsSchema,
  userReviewSchema,
  userCorrectionSchema,
  userTagSuggestionSchema,
  priceAlertSchema,
  parseSearchParams,
  parseRequestBody,
  type PaginationInput,
  type PriceRangeInput,
  type ProductListParams,
  type UserReviewInput,
  type UserCorrectionInput,
  type UserTagSuggestionInput,
  type PriceAlertInput,
} from './lib/api-schemas';
