/**
 * フィルター関連の共通定数
 *
 * 共有パッケージから再エクスポート
 */

// Re-export all filter constants from shared package
export {
  // ひらがな・アルファベット定数
  HIRAGANA_GROUPS,
  HIRAGANA_KEYS,
  ALPHABET,
  // ASP/Provider マッピング
  ASP_TO_PROVIDER_ID,
  getProviderId,
  // ソートオプション
  SORT_OPTIONS,
  // 価格帯フィルター
  PRICE_RANGES,
  parsePriceRange,
  // 出演者タイプ
  PERFORMER_TYPE_OPTIONS,
} from '@adult-v/shared/constants';

// Re-export types
export type { SortOption, PerformerType } from '@adult-v/shared/constants';
