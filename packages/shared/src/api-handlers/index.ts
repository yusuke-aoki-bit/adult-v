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
export type { DiscoverHandlerDeps, DiscoverProduct, DiscoverFilters } from './discover';
export { createDiscoverHandler } from './discover';

// Notifications handlers
export type { NotificationsHandlerDeps, PushSubscription, SubscriptionKeys } from './notifications';
export { createNotificationsSubscribeHandler, createNotificationsUnsubscribeHandler } from './notifications';

// Product Auto Tags handlers
export type { AutoTagsHandlerDeps } from './product-auto-tags';
export { createAutoTagsHandler } from './product-auto-tags';

// Product Keywords handlers
export type { KeywordsHandlerDeps } from './product-keywords';
export { createKeywordsHandler } from './product-keywords';

// Product SNS Summary handlers
export type { SNSSummaryHandlerDeps } from './product-sns-summary';
export { createSNSSummaryHandler } from './product-sns-summary';

// Admin Stats handlers
export type { AdminStatsHandlerDeps, AdminStatsHandlerOptions, ASPTotal as AdminASPTotal } from './admin-stats';
export { createAdminStatsHandler } from './admin-stats';

// Performer Similar handlers
export type { PerformerSimilarHandlerDeps, PerformerSimilarHandlerOptions } from './performer-similar';
export { createPerformerSimilarHandler } from './performer-similar';

// Product Similar handlers
export type { ProductSimilarHandlerDeps, ProductSimilarHandlerOptions } from './product-similar';
export { createProductSimilarHandler } from './product-similar';

// User Reviews handlers
export type { UserReviewsHandlerDeps, UserReview, UserReviewWithVote } from './user-reviews';
export { createUserReviewsGetHandler, createUserReviewsPostHandler, createUserReviewVoteHandler } from './user-reviews';

// User Tag Suggestions handlers
export type { UserTagSuggestionsHandlerDeps, UserTagSuggestion, UserTagSuggestionWithVote } from './user-tag-suggestions';
export { createUserTagSuggestionsGetHandler, createUserTagSuggestionsPostHandler, createUserTagVoteHandler } from './user-tag-suggestions';

// User Performer Suggestions handlers
export type { UserPerformerSuggestionsHandlerDeps, UserPerformerSuggestion, UserPerformerSuggestionWithVote } from './user-performer-suggestions';
export { createUserPerformerSuggestionsGetHandler, createUserPerformerSuggestionsPostHandler, createUserPerformerVoteHandler } from './user-performer-suggestions';

// Public Favorite Lists handlers
export type { PublicFavoriteListsHandlerDeps, PublicFavoriteList, PublicFavoriteListItem } from './public-favorite-lists';
export {
  createPublicFavoriteListsGetHandler,
  createPublicFavoriteListsPostHandler,
  createPublicFavoriteListsPutHandler,
  createPublicFavoriteListsDeleteHandler,
  createPublicFavoriteListItemsHandler,
  createPublicFavoriteListLikeHandler,
} from './public-favorite-lists';

// Footer Actresses handlers
export type { FooterActressesHandlerDeps } from './footer-actresses';
export { createFooterActressesHandler } from './footer-actresses';

// Footer Links handlers
export type { FooterLinksHandlerDeps } from './footer-links';
export { createFooterLinksHandler } from './footer-links';

// Sale Prediction handlers
export type { SalePredictionHandlerDeps } from './sale-prediction';
export { createSalePredictionHandler } from './sale-prediction';

// Rookie Performers handlers
export type { RookiePerformersHandlerDeps, RookiePerformer } from './rookie-performers';
export { createRookiePerformersHandler } from './rookie-performers';

// Price Alerts handlers
export type { PriceAlertsHandlerDeps, PriceAlertInput } from './price-alerts';
export { createPriceAlertsHandler } from './price-alerts';

// User Corrections handlers
export type { UserCorrectionsHandlerDeps, UserCorrection } from './user-corrections';
export {
  createUserCorrectionsGetHandler,
  createUserCorrectionsPostHandler,
  createUserCorrectionsReviewHandler,
  createUserCorrectionsDeleteHandler,
} from './user-corrections';
