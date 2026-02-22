/**
 * Fanza App - Database Queries
 * 共通ファクトリ (createAppQueries) を使用し、fanza固有のオーバーライドはなし
 */
import { getDb } from './index';
import { products, performers, productPerformers, tags, productTags, productSources, performerAliases, productImages, productVideos, productSales, productRatingSummary } from './schema';
import type { Product as ProductType, Actress as ActressType } from '@/types/product';
import { mapLegacyProvider } from '@adult-v/shared/lib/provider-utils';
import { getDtiServiceFromUrl } from '@adult-v/shared/lib/image-utils';
import { getLocalizedTitle, getLocalizedDescription, getLocalizedPerformerName, getLocalizedPerformerBio, getLocalizedTagName, getLocalizedAiReview } from '@adult-v/shared/lib/localization';
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
import type {
  RandomProduct,
  ProductSourceWithSales,
  SeriesInfo,
} from '@adult-v/shared/db-queries/create-app-queries';

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

// 全クエリ関数をエクスポート（fanzaはキャッシュオーバーライドなし）
export const {
  getProductById,
  searchProductByProductId,
  getProducts,
  getProductsCount,
  getProductsByActress,
  getActresses,
  getActressesCount,
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
  getUncategorizedProductsCount,
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
  getSaleProducts,
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
