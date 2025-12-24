/**
 * Google Analytics Data API 統合
 * Re-exports from shared package
 */
export {
  getPopularPages,
  getPopularContent,
  getSearchTerms,
  getTrafficSources,
  checkAnalyticsApiConfig,
} from '@adult-v/shared/lib/google-analytics';

export type { PageViewData, PopularContent } from '@adult-v/shared/lib/google-analytics';
