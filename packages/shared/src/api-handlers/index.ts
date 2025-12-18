// Actresses handlers
export type { ActressesHandlerDeps } from './actresses';
export { createActressesHandler } from './actresses';

// Actress by ID handler
export type { ActressByIdHandlerDeps } from './actress-by-id';
export { createActressByIdHandler } from './actress-by-id';

// Makers handlers
export type { MakersHandlerDeps } from './makers';
export { createMakersGetHandler, createMakersPostHandler } from './makers';

// Recommendations handlers
export type { RecommendationsHandlerDeps } from './recommendations';
export { createRecommendationsHandler } from './recommendations';

// Weekly highlights handlers
export type { WeeklyHighlightsHandlerDeps } from './weekly-highlights';
export { createWeeklyHighlightsHandler } from './weekly-highlights';

// Track view handlers
export type { TrackViewHandlerDeps } from './track-view';
export { createTrackViewHandler } from './track-view';

// Age verify handlers
export type { AgeVerifyHandlerDeps } from './age-verify';
export { createAgeVerifyPostHandler, createAgeVerifyDeleteHandler } from './age-verify';

// Ranking actresses handlers
export type { RankingActressesHandlerDeps } from './ranking-actresses';
export { createRankingActressesHandler } from './ranking-actresses';

// Ranking products handlers
export type { RankingProductsHandlerDeps } from './ranking-products';
export { createRankingProductsHandler } from './ranking-products';

// Search autocomplete handlers
export type { SearchAutocompleteHandlerDeps } from './search-autocomplete';
export { createSearchAutocompleteHandler } from './search-autocomplete';

// Series handlers
export type { SeriesHandlerDeps } from './series';
export { createSeriesHandler } from './series';

// Products handlers
export type { ProductsHandlerDeps, ProductsHandlerOptions, GetProductsParams, SortOption } from './products';
export { createProductsHandler } from './products';

// Product by ID handler
export type { ProductByIdHandlerDeps } from './product-by-id';
export { createProductByIdHandler } from './product-by-id';

// Stats ASP handlers
export type { StatsAspHandlerDeps, StatsAspHandlerOptions, ASPTotal, ASPStat } from './stats-asp';
export { createStatsAspHandler } from './stats-asp';

// Stats Sales handlers
export type { StatsSalesHandlerDeps, StatsSalesHandlerOptions, SaleStats } from './stats-sales';
export { createStatsSalesHandler } from './stats-sales';

// Analytics handlers
export type { AnalyticsHandlerDeps, AnalyticsData } from './analytics';
export { createAnalyticsHandler } from './analytics';

// Discover handlers
export type { DiscoverHandlerDeps, DiscoverProduct } from './discover';
export { createDiscoverHandler } from './discover';

// Notifications handlers
export type { NotificationsHandlerDeps, PushSubscription, SubscriptionKeys } from './notifications';
export { createNotificationsSubscribeHandler, createNotificationsUnsubscribeHandler } from './notifications';
