/**
 * Schema Index
 * 全テーブルと型をまとめてエクスポート
 */

// Products
export {
  products,
  productSources,
  productPrices,
  productSales,
  productImages,
  productVideos,
  productTranslations,
} from './products';
export type {
  Product,
  NewProduct,
  ProductSource,
  NewProductSource,
  ProductPrice,
  NewProductPrice,
  ProductImage,
  NewProductImage,
  ProductVideo,
  NewProductVideo,
  ProductTranslation,
  NewProductTranslation,
} from './products';

// Performers
export {
  performers,
  performerAliases,
  performerExternalIds,
  performerImages,
} from './performers';
export type {
  Performer,
  NewPerformer,
  PerformerAlias,
  NewPerformerAlias,
  PerformerImage,
  NewPerformerImage,
} from './performers';

// Tags
export {
  tags,
  productTags,
  productPerformers,
} from './tags';
export type {
  Tag,
  NewTag,
} from './tags';

// Reviews
export {
  productReviews,
  productRatingSummary,
} from './reviews';
export type {
  ProductReview,
  NewProductReview,
  ProductRatingSummary,
  NewProductRatingSummary,
} from './reviews';

// Raw Data
export {
  rawCsvData,
  rawHtmlData,
  dugaRawResponses,
  sokmilRawResponses,
  mgsRawPages,
  productRawDataLinks,
  wikiCrawlData,
  wikiPerformerIndex,
} from './raw-data';
export type {
  RawCsvData,
  NewRawCsvData,
  RawHtmlData,
  NewRawHtmlData,
  DugaRawResponse,
  NewDugaRawResponse,
  SokmilRawResponse,
  NewSokmilRawResponse,
  MgsRawPage,
  NewMgsRawPage,
  ProductRawDataLink,
  NewProductRawDataLink,
  WikiCrawlData,
  NewWikiCrawlData,
  WikiPerformerIndex,
  NewWikiPerformerIndex,
} from './raw-data';

// User Content
export {
  userReviews,
  userTagSuggestions,
  userCorrections,
  publicFavoriteLists,
  publicFavoriteListItems,
  userReviewVotes,
  userTagVotes,
  publicListLikes,
  userPerformerSuggestions,
  userPerformerVotes,
  productRankingVotes,
} from './user-content';
export type {
  UserReview,
  NewUserReview,
  UserTagSuggestion,
  NewUserTagSuggestion,
  UserCorrection,
  NewUserCorrection,
  PublicFavoriteList,
  NewPublicFavoriteList,
  PublicFavoriteListItem,
  NewPublicFavoriteListItem,
  UserReviewVote,
  NewUserReviewVote,
  UserTagVote,
  NewUserTagVote,
  PublicListLike,
  NewPublicListLike,
  UserPerformerSuggestion,
  NewUserPerformerSuggestion,
  UserPerformerVote,
  NewUserPerformerVote,
} from './user-content';

// Analytics
export {
  priceHistory,
  salePatterns,
  videoTimestamps,
} from './analytics';
export type {
  PriceHistory,
  NewPriceHistory,
  SalePattern,
  NewSalePattern,
  VideoTimestamp,
  NewVideoTimestamp,
} from './analytics';
