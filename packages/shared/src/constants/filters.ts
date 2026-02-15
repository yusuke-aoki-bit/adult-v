/**
 * フィルター関連の共通定数
 *
 * UIコンポーネント間で共有される定数を一元管理
 */

import type { SortOption, PerformerType } from '../types/product.js';
import type { ProviderId } from '../asp-registry';

// Re-export types for convenience
export type { SortOption, PerformerType };

// ASP関連の定数をレジストリから re-export
export { ASP_DISPLAY_ORDER, ASP_TO_PROVIDER_ID } from '../asp-registry';
import { ASP_TO_PROVIDER_ID } from '../asp-registry';

// ============================================================
// ひらがな・アルファベット定数
// ============================================================

/**
 * ひらがな行のグループ分け
 * 日本語名の頭文字フィルターで使用
 */
export const HIRAGANA_GROUPS: Record<string, string[]> = {
  'あ': ['あ', 'い', 'う', 'え', 'お'],
  'か': ['か', 'き', 'く', 'け', 'こ'],
  'さ': ['さ', 'し', 'す', 'せ', 'そ'],
  'た': ['た', 'ち', 'つ', 'て', 'と'],
  'な': ['な', 'に', 'ぬ', 'ね', 'の'],
  'は': ['は', 'ひ', 'ふ', 'へ', 'ほ'],
  'ま': ['ま', 'み', 'む', 'め', 'も'],
  'や': ['や', 'ゆ', 'よ'],
  'ら': ['ら', 'り', 'る', 'れ', 'ろ'],
  'わ': ['わ', 'を', 'ん'],
};

/**
 * ひらがな行のキー（順序保証）
 */
export const HIRAGANA_KEYS = ['あ', 'か', 'さ', 'た', 'な', 'は', 'ま', 'や', 'ら', 'わ'] as const;

/**
 * アルファベット配列
 */
export const ALPHABET = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
] as const;

// ============================================================
// ASP/Provider マッピング
// ============================================================

/**
 * ASP名からProviderIdを取得
 */
export function getProviderId(aspName: string): ProviderId | undefined {
  return ASP_TO_PROVIDER_ID[aspName];
}

// ============================================================
// ソートオプション
// ============================================================

/**
 * ソートオプションのラベル
 */
export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'releaseDateDesc', label: 'リリース日（新しい順）' },
  { value: 'releaseDateAsc', label: 'リリース日（古い順）' },
  { value: 'priceAsc', label: '価格（安い順）' },
  { value: 'priceDesc', label: '価格（高い順）' },
  { value: 'ratingDesc', label: '評価（高い順）' },
  { value: 'reviewCountDesc', label: 'レビュー数（多い順）' },
  { value: 'nameAsc', label: 'タイトル（A-Z）' },
  { value: 'nameDesc', label: 'タイトル（Z-A）' },
  { value: 'viewsDesc', label: '閲覧数（多い順）' },
];

/**
 * 価格帯フィルターオプション
 */
export const PRICE_RANGES: { value: string; label: string; min?: number; max?: number }[] = [
  { value: '', label: 'すべて' },
  { value: '0-1000', label: '¥0 - ¥1,000', min: 0, max: 1000 },
  { value: '1000-3000', label: '¥1,000 - ¥3,000', min: 1000, max: 3000 },
  { value: '3000-5000', label: '¥3,000 - ¥5,000', min: 3000, max: 5000 },
  { value: '5000-', label: '¥5,000以上', min: 5000 },
];

/**
 * 価格帯文字列をパース
 */
export function parsePriceRange(value: string): { min?: number; max?: number } {
  if (!value) return {};
  const [minStr, maxStr] = value.split('-');
  const result: { min?: number; max?: number } = {};
  if (minStr) result.min = parseInt(minStr, 10);
  if (maxStr) result.max = parseInt(maxStr, 10);
  return result;
}

// ============================================================
// 出演者タイプ
// ============================================================

/**
 * 出演者タイプのラベル
 */
export const PERFORMER_TYPE_OPTIONS: { value: PerformerType | ''; label: string }[] = [
  { value: '', label: 'すべて' },
  { value: 'solo', label: '単体作品' },
  { value: 'multi', label: '複数出演' },
];
