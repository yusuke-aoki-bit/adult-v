/**
 * 商品同一性マッチング モジュール
 *
 * 品番、タイトル、演者情報を使用して同一商品を検出し、
 * product_identity_groups にグルーピングする
 *
 * @example
 * ```typescript
 * import { processProductIdentity, fetchProductForMatching } from './product-identity';
 *
 * // 商品をグループに登録
 * const product = await fetchProductForMatching(productId);
 * if (product) {
 *   const result = await processProductIdentity(product);
 *   console.log(result.action, result.groupId);
 * }
 * ```
 */

// Types
export type {
  MatchingConfig,
  MatchResult,
  ProductForMatching,
  IdentityGroup,
  GroupMember,
  MatchingMethod,
  BatchProcessingOptions,
  BatchProcessingStats,
} from './types';

export {
  DEFAULT_MATCHING_CONFIG,
  TITLE_MATCH_EXCLUDED_ASPS,
  ASP_PRIORITY,
  createInitialStats,
} from './types';

// Code Matcher
export {
  findMatchByProductCode,
  extractAndNormalizeCode,
  calculateCodeSimilarity,
} from './code-matcher';

// Title Matcher
export {
  findMatchByTitleAndPerformers,
  normalizeTitle,
  calculateTitleSimilarity,
} from './title-matcher';

// Group Manager
export {
  createGroup,
  addToGroup,
  getProductGroup,
  mergeGroups,
  removeFromGroup,
  getGroupMembers,
  getGroupStats,
} from './group-manager';

// Product Matcher (Main API)
export {
  findMatch,
  processProductIdentity,
  fetchProductForMatching,
  fetchUngroupedProducts,
  fetchRecentProducts,
  countUngroupedProducts,
} from './product-matcher';
