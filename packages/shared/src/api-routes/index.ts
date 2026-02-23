/**
 * Pre-wired API Route Handlers
 *
 * All dependencies resolved internally — app route files only need to re-export.
 * Route segment config (dynamic, revalidate, runtime) must still be declared in each route file.
 *
 * Covers Category 2b (getDb+tables), 2c (tables+operators), 2d (security), 2e (complex wrapping).
 * Category 2a (simple DI with app queries) is NOT included — those routes are already 4-8 lines.
 */

import { NextRequest, NextResponse } from 'next/server';

// Database — tables & getDb
import {
  getDb as _getDb,
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
  userCorrections,
  userContributionStats,
  userReviews,
  userReviewVotes,
  userTagSuggestions,
  userTagVotes,
  userPerformerSuggestions,
  userPerformerVotes,
  publicFavoriteLists,
  publicFavoriteListItems,
  publicListLikes,
  footerFeaturedActresses,
} from '@adult-v/database';

// Drizzle operators — cast to `any` to bridge type mismatch between packages
import {
  eq as _eq,
  and as _and,
  or as _or,
  desc as _desc,
  asc as _asc,
  sql as _sql,
  gte as _gte,
  ilike as _ilike,
  inArray as _inArray,
} from 'drizzle-orm';

const getDb = _getDb as any;
const eq = _eq as any;
const and = _and as any;
const or = _or as any;
const desc = _desc as any;
const asc = _asc as any;
const sql = _sql as any;
const gte = _gte as any;
const ilike = _ilike as any;
const inArray = _inArray as any;

// Security
import { checkRateLimit, getClientIP, RATE_LIMITS } from '../lib/rate-limit';
import { detectBot, validateSecurityHeaders } from '../lib/bot-detection';

// Cache
import { getCache, setCache, generateCacheKey } from '../lib/cache';

// ASP
import { getAllASPTotals, mapDBNameToASPName } from '../lib/asp-totals';

// Auth
import { verifyCronRequest, unauthorizedResponse } from '../lib/cron-auth';

// App queries factory + utilities
import { createAppQueries } from '../db-queries/create-app-queries';
import { createRecommendationsQueries } from '../db-queries';
import { isValidPerformerName } from '../lib/performer-validation';
import { getProviderLabel } from '../constants/provider-labels';
import { normalizeAspName, buildAspNormalizationSql } from '../lib/asp-utils';
import { generateProductIdVariations } from '../lib/product-id-utils';
import { getDtiServiceFromUrl } from '../lib/image-utils';
import { mapLegacyProvider } from '../lib/provider-utils';
import {
  getLocalizedTitle,
  getLocalizedDescription,
  getLocalizedPerformerName,
  getLocalizedPerformerBio,
  getLocalizedTagName,
  getLocalizedAiReview,
} from '../lib/localization';
import {
  generateProductDescription,
  generateActressProfile,
  generateUserPreferenceProfile,
  analyzeSearchQuery,
  analyzeViewingHistory,
  analyzeImageForSearch,
  calculateImageTextSimilarity,
} from '../lib/llm-service';
import { generateQueryEmbedding } from '../lib/embedding-service';

// Embed stats queries (standalone — no DI needed)
import {
  getOverallStats,
  getTopPerformersByProductCount,
  getTopGenres,
  getMonthlyReleaseStats,
} from '../db-queries/stats-queries';

// Handler factories
import {
  // 2b
  createSearchAutocompleteHandler,
  createRankingProductsHandler,
  createRankingActressesHandler,
  createFooterActressesHandler,
  createFooterLinksHandler,
  createSalePredictionHandler,
  // 2c
  createUserCorrectionsGetHandler,
  createUserCorrectionsPostHandler,
  createUserCorrectionsReviewHandler,
  createUserCorrectionsDeleteHandler,
  createUserReviewsGetHandler,
  createUserReviewsPostHandler,
  createUserTagSuggestionsGetHandler,
  createUserTagSuggestionsPostHandler,
  createUserPerformerSuggestionsGetHandler,
  createUserPerformerSuggestionsPostHandler,
  createPublicFavoriteListsGetHandler,
  createPublicFavoriteListsPostHandler,
  createPublicFavoriteListsPutHandler,
  createPublicFavoriteListsDeleteHandler,
  createPublicFavoriteListItemsHandler,
  createPublicFavoriteListLikeHandler,
  createRookiePerformersHandler,
  // 2d
  createAgeVerifyPostHandler,
  createAgeVerifyDeleteHandler,
  createTrackViewHandler,
  // 2e
  createAutoTagsHandler,
  createKeywordsHandler,
  createSNSSummaryHandler,
  createPerformerSimilarHandler,
  createProductSimilarHandler,
  createAdminStatsHandler,
  // Category C (small-medium)
  createAiProfileHandler,
  createMakerByIdHandler,
  createProductSearchByIdHandler,
  createRecommendationsActressesHandler,
  createViewingPatternsHandler,
  createProductPricesSingleHandler,
  createProductRelatedHandler,
  createProductAiDescriptionHandler,
  createProductGenerateDescriptionHandler,
  createEmbedStatsHandler,
  // Category C (large)
  createAlsoViewedHandler,
  createProductSearchHandler,
  createProductBatchPricesHandler,
  createSaleCalendarHandler,
  createGenerateProfileHandler,
  createUserProfileHandler,
  createPriceAlertsRouteHandler,
  createSearchAiHandler,
  createSemanticSearchHandler,
  createTrendsHandler,
  createSearchImageHandler,
  createRecommendationsFromHistoryHandler,
  createPerformerRelationsHandler,
} from '../api-handlers';

// ====== App Queries (shared instance for Category C routes) ======

// No-op cache passthrough — route-level `revalidate` handles caching
const noopCache = (fn: (...args: any[]) => Promise<any>) => fn;

const appQueries = createAppQueries({
  getDb: getDb as never,
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
  unstable_cache: noopCache as any,
});

const recQueries = createRecommendationsQueries({
  getDb: getDb as never,
  products,
  productPerformers,
  productTags,
  productSources,
});

// ====== Common dependency groups ======

const correctionsDeps = {
  getDb,
  userCorrections,
  userContributionStats,
  eq,
  and,
  desc,
  sql,
};

const reviewsDeps = {
  getDb,
  userReviews,
  userReviewVotes,
  products,
  eq,
  and,
  desc,
  sql,
};

const tagSuggestionsDeps = {
  getDb,
  userTagSuggestions,
  userTagVotes,
  products,
  tags,
  eq,
  and,
  desc,
  sql,
};

const performerSuggestionsDeps = {
  getDb,
  userPerformerSuggestions,
  userPerformerVotes,
  products,
  performers,
  eq,
  and,
  or,
  desc,
  ilike,
  sql,
};

const favoriteListsDeps = {
  getDb,
  publicFavoriteLists,
  publicFavoriteListItems,
  publicListLikes,
  products,
  eq,
  and,
  desc,
  asc,
  sql,
};

const securityDeps = {
  checkRateLimit,
  getClientIP,
  RATE_LIMITS,
  detectBot,
  validateSecurityHeaders,
};

// ====== Inline helper functions ======

async function trackProductView(productId: number) {
  const db = getDb();
  await db.execute(sql`
    INSERT INTO product_views (product_id, viewed_at) VALUES (${productId}, NOW())
  `);
}

async function trackPerformerView(performerId: number) {
  const db = getDb();
  await db.execute(sql`
    INSERT INTO performer_views (performer_id, viewed_at) VALUES (${performerId}, NOW())
  `);
}

// ====================================================================
// Category 2b: getDb + tables
// ====================================================================

export const apiSearchAutocompleteGET = createSearchAutocompleteHandler({
  getDb: getDb as never,
  products,
  performers,
  tags,
  productSources,
});

export const apiRankingProductsGET = createRankingProductsHandler({
  getDb,
  productSources,
});

export const apiRankingActressesGET = createRankingActressesHandler({
  getDb,
  performers,
});

export const apiFooterActressesGET = createFooterActressesHandler({
  getDb,
  footerFeaturedActresses: footerFeaturedActresses as any,
});

export const apiFooterLinksGET = createFooterLinksHandler({
  getDb,
  tags,
  productTags,
});

export const apiSalePredictionGET = createSalePredictionHandler({
  getDb,
  sql,
});

// ====================================================================
// Category 2c: tables + operators
// ====================================================================

export const apiCorrectionsGET = createUserCorrectionsGetHandler(correctionsDeps);
export const apiCorrectionsPOST = createUserCorrectionsPostHandler(correctionsDeps);

// corrections/[id] — handlers need async params unwrapping
const _correctionsReviewHandler = createUserCorrectionsReviewHandler(correctionsDeps);
const _correctionsDeleteHandler = createUserCorrectionsDeleteHandler(correctionsDeps);

export async function apiCorrectionByIdPUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  return _correctionsReviewHandler(request, { params });
}

export async function apiCorrectionByIdDELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  return _correctionsDeleteHandler(request, { params });
}

export const apiReviewsGET = createUserReviewsGetHandler(reviewsDeps);
export const apiReviewsPOST = createUserReviewsPostHandler(reviewsDeps);

export const apiTagSuggestionsGET = createUserTagSuggestionsGetHandler(tagSuggestionsDeps);
export const apiTagSuggestionsPOST = createUserTagSuggestionsPostHandler(tagSuggestionsDeps);

export const apiPerformerSuggestionsGET = createUserPerformerSuggestionsGetHandler(performerSuggestionsDeps);
export const apiPerformerSuggestionsPOST = createUserPerformerSuggestionsPostHandler(performerSuggestionsDeps);

export const apiFavoriteListsGET = createPublicFavoriteListsGetHandler(favoriteListsDeps);
export const apiFavoriteListsPOST = createPublicFavoriteListsPostHandler(favoriteListsDeps);
export const apiFavoriteListsPUT = createPublicFavoriteListsPutHandler(favoriteListsDeps);
export const apiFavoriteListsDELETE = createPublicFavoriteListsDeleteHandler(favoriteListsDeps);
export const apiFavoriteListItemsPOST = createPublicFavoriteListItemsHandler(favoriteListsDeps);
export const apiFavoriteListLikePOST = createPublicFavoriteListLikeHandler(favoriteListsDeps);

export const apiRookiesGET = createRookiePerformersHandler({
  getDb,
  performers,
  productPerformers,
  products,
  eq,
  desc,
  gte,
  and,
  sql,
});

// ====================================================================
// Category 2d: Security
// ====================================================================

export const apiAgeVerifyPOST = createAgeVerifyPostHandler(securityDeps);
export const apiAgeVerifyDELETE = createAgeVerifyDeleteHandler(securityDeps);

export const apiTrackViewPOST = createTrackViewHandler({
  trackProductView,
  trackPerformerView,
});

// ====================================================================
// Category 2e: Complex wrapping
// ====================================================================

// --- Auto Tags: inline closures ---
export const apiAutoTagsGET = createAutoTagsHandler({
  async getProductWithTags(normalizedId: string) {
    const db = getDb();
    const productData = await db
      .select({ id: products.id, title: products.title, description: products.description })
      .from(products)
      .where(eq(products.normalizedProductId, normalizedId))
      .limit(1);
    if (productData.length === 0) return null;
    const product = productData[0];
    const existingTagsData = await db
      .select({ name: tags.name })
      .from(productTags)
      .innerJoin(tags, eq(productTags.tagId, tags.id))
      .where(eq(productTags.productId, product.id));
    return {
      id: product.id,
      title: product.title,
      description: product.description,
      existingTags: existingTagsData.map((t: { name: string }) => t.name),
    };
  },
  async getAvailableTags() {
    const db = getDb();
    const result = await db.execute(sql`SELECT name FROM tags ORDER BY name LIMIT 100`);
    return (result.rows as Array<{ name: string }>).map((t: { name: string }) => t.name);
  },
});

// --- Keywords: inline closure ---
export const apiKeywordsGET = createKeywordsHandler({
  async getProductWithDetails(normalizedId: string) {
    const db = getDb();
    const productData = await db
      .select({ id: products.id, title: products.title, description: products.description })
      .from(products)
      .where(eq(products.normalizedProductId, normalizedId))
      .limit(1);
    if (productData.length === 0) return null;
    const product = productData[0];
    const performersData = await db
      .select({ name: performers.name })
      .from(productPerformers)
      .innerJoin(performers, eq(productPerformers.performerId, performers.id))
      .where(eq(productPerformers.productId, product.id));
    const tagsData = await db
      .select({ name: tags.name })
      .from(productTags)
      .innerJoin(tags, eq(productTags.tagId, tags.id))
      .where(eq(productTags.productId, product.id));
    return {
      id: product.id,
      title: product.title,
      description: product.description,
      performers: performersData.map((p: { name: string }) => p.name),
      tags: tagsData.map((t: { name: string }) => t.name),
    };
  },
});

// --- SNS Summary: inline closure ---
export const apiSnsSummaryGET = createSNSSummaryHandler({
  async getProductWithDetails(normalizedId: string) {
    const db = getDb();
    const productData = await db
      .select({
        id: products.id,
        title: products.title,
        description: products.description,
        releaseDate: products.releaseDate,
      })
      .from(products)
      .where(eq(products.normalizedProductId, normalizedId))
      .limit(1);
    if (productData.length === 0) return null;
    const product = productData[0];
    const performersData = await db
      .select({ name: performers.name })
      .from(productPerformers)
      .innerJoin(performers, eq(productPerformers.performerId, performers.id))
      .where(eq(productPerformers.productId, product.id));
    const tagsData = await db
      .select({ name: tags.name })
      .from(productTags)
      .innerJoin(tags, eq(productTags.tagId, tags.id))
      .where(eq(productTags.productId, product.id));
    return {
      id: product.id,
      title: product.title,
      description: product.description,
      releaseDate: product.releaseDate,
      performers: performersData.map((p: { name: string }) => p.name),
      tags: tagsData.map((t: { name: string }) => t.name),
    };
  },
});

// --- Performer Similar: wrapper with param extraction ---
const _performerSimilarHandler = createPerformerSimilarHandler(
  {
    getDb: getDb as Parameters<typeof createPerformerSimilarHandler>[0]['getDb'],
    performers,
    getCache,
    setCache,
    generateCacheKey,
    aspName: 'mgs',
  },
  { siteMode: 'mgs' },
);

export async function apiPerformerSimilarGET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const performerId = parseInt(id, 10);
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '20', 10);
  const result = await _performerSimilarHandler(performerId, limit);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data);
}

// --- Product Similar: wrapper with param extraction ---
const _productSimilarHandler = createProductSimilarHandler(
  {
    getDb: getDb as Parameters<typeof createProductSimilarHandler>[0]['getDb'],
    products,
    getCache,
    setCache,
    generateCacheKey,
    aspName: 'mgs',
  },
  { siteMode: 'mgs' },
);

export async function apiProductSimilarGET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const productId = parseInt(id, 10);
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '12', 10);
  const result = await _productSimilarHandler(productId, limit);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data);
}

// --- Admin Stats: auth wrapper ---
const _adminStatsHandler = createAdminStatsHandler(
  { getDb, getAllASPTotals, mapDBNameToASPName },
  { includeSeoIndexing: true },
);

export async function apiAdminStatsGET(request: NextRequest) {
  if (!(await verifyCronRequest(request))) {
    return unauthorizedResponse();
  }
  return _adminStatsHandler();
}

// ====================================================================
// Category C: New handler factories (small-medium)
// ====================================================================

// --- AI Profile (placeholder 404) ---
export const apiAiProfileGET = createAiProfileHandler();

// --- Maker by ID ---
export const apiMakerByIdGET = createMakerByIdHandler({
  getMakerById: appQueries.getMakerById as any,
});

// --- Product Search by ID ---
export const apiProductSearchByIdGET = createProductSearchByIdHandler({
  searchProductByProductId: appQueries.searchProductByProductId as any,
});

// --- Recommendations Actresses ---
export const apiRecommendationsActressesPOST = createRecommendationsActressesHandler({
  getRecommendedActressesFromFavorites: recQueries.getRecommendedActressesFromFavorites,
});

// --- Viewing Patterns ---
export const apiViewingPatternsGET = createViewingPatternsHandler({
  getViewingPatternStats: recQueries.getViewingPatternStats,
});

// --- Product Prices (single) ---
export const apiProductPricesGET = createProductPricesSingleHandler({
  getProductSourcesWithSales: appQueries.getProductSourcesWithSales as any,
  getProviderLabel,
});

// --- Product Related ---
export const apiProductRelatedGET = createProductRelatedHandler({
  getRelatedProductsByNames: recQueries.getRelatedProductsByNames as any,
});

// --- Product AI Description ---
export const apiProductAiDescriptionGET = createProductAiDescriptionHandler({
  getDb,
  products,
  eq,
});

// --- Product Generate Description ---
export const apiProductGenerateDescriptionGET = createProductGenerateDescriptionHandler({
  getProductById: appQueries.getProductById as any,
  generateProductDescription,
});

// --- Embed Stats (web) ---
const _embedStats = createEmbedStatsHandler(
  { getOverallStats, getTopPerformersByProductCount, getTopGenres, getMonthlyReleaseStats },
  { sourceLabel: 'Adult Viewer Lab' },
);
export const apiEmbedStatsGET = _embedStats.GET;
export const apiEmbedStatsOPTIONS = _embedStats.OPTIONS;

// --- Embed Stats (fanza) ---
const _embedStatsFanza = createEmbedStatsHandler(
  { getOverallStats, getTopPerformersByProductCount, getTopGenres, getMonthlyReleaseStats },
  { sourceLabel: 'AVVIEWER LAB' },
);
export const apiEmbedStatsFanzaGET = _embedStatsFanza.GET;
export const apiEmbedStatsFanzaOPTIONS = _embedStatsFanza.OPTIONS;

// ====================================================================
// Category C: New handler factories (large)
// ====================================================================

// --- Also Viewed ---
export const apiAlsoViewedGET = createAlsoViewedHandler({
  getDb,
  products,
  productSources,
  sql,
});

// --- Product Search ---
export const apiProductSearchGET = createProductSearchHandler({
  getProducts: appQueries.getProducts as any,
});

// --- Product Batch Prices ---
export const apiProductBatchPricesPOST = createProductBatchPricesHandler({
  getDb,
  products,
  productSources,
  productSales,
  inArray,
  eq,
  and,
  sql,
});

// --- Sale Calendar ---
export const apiSaleCalendarGET = createSaleCalendarHandler({
  getDb,
  sql,
});

// --- Generate Profile ---
export const apiGenerateProfileGET = createGenerateProfileHandler({
  getDb,
  getActressById: appQueries.getActressById as any,
  generateActressProfile,
  products,
  productPerformers,
  productTags,
  productSources,
  tags,
  sql,
  desc,
  inArray,
});

// --- User Profile ---
export const apiUserProfilePOST = createUserProfileHandler({
  getDb,
  products,
  productPerformers,
  productTags,
  performers,
  tags,
  inArray,
  eq,
  generateUserPreferenceProfile,
});

// --- Price Alerts Route ---
const _priceAlerts = createPriceAlertsRouteHandler({ getDb, sql });
export const apiPriceAlertsRouteGET = _priceAlerts.GET;
export const apiPriceAlertsRoutePOST = _priceAlerts.POST;
export const apiPriceAlertsRouteDELETE = _priceAlerts.DELETE;

// --- Search AI ---
export const apiSearchAiPOST = createSearchAiHandler({
  getDb,
  tags,
  performers,
  eq,
  desc,
  sql,
  ilike,
  or,
  analyzeSearchQuery,
});

// --- Semantic Search ---
export const apiSemanticSearchGET = createSemanticSearchHandler({
  getDb,
  sql,
  generateQueryEmbedding,
});

// --- Trends (web) ---
export const apiTrendsGET = createTrendsHandler(
  { getDb, sql, getCache, setCache, generateCacheKey },
  { cachePrefix: 'trends:web' },
);

// --- Trends (fanza) ---
export const apiTrendsFanzaGET = createTrendsHandler(
  { getDb, sql, getCache, setCache, generateCacheKey },
  { cachePrefix: 'trends:fanza' },
);

// --- Search Image ---
export const apiSearchImagePOST = createSearchImageHandler({
  getDb,
  products,
  productTags,
  productSources,
  tags,
  sql,
  inArray,
  analyzeImageForSearch,
  calculateImageTextSimilarity,
});

// --- Recommendations From History ---
export const apiRecommendationsFromHistoryPOST = createRecommendationsFromHistoryHandler({
  getDb,
  products,
  productPerformers,
  productTags,
  performers,
  tags,
  eq,
  inArray,
  sql,
  desc,
  and,
  analyzeViewingHistory,
});

// --- Performer Relations (web) ---
export const apiPerformerRelationsGET = createPerformerRelationsHandler(
  { getDb, performers, sql, eq, getCache, setCache, generateCacheKey },
  { cachePrefix: 'relations:web:v5' },
);

// --- Performer Relations (fanza) ---
export const apiPerformerRelationsFanzaGET = createPerformerRelationsHandler(
  { getDb, performers, sql, eq, getCache, setCache, generateCacheKey },
  { cachePrefix: 'relations:fanza:v5' },
);
