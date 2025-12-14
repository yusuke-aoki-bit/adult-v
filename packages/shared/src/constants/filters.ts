/**
 * フィルター関連の共通定数
 *
 * UIコンポーネント間で共有される定数を一元管理
 */

import type { ProviderId, SortOption } from '../types/product.js';

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
 * ASP名をProviderId型に変換するマッピング
 * 大文字小文字両方に対応
 */
export const ASP_TO_PROVIDER_ID: Record<string, ProviderId | undefined> = {
  // 主要ASP
  'DUGA': 'duga',
  'duga': 'duga',
  'Sokmil': 'sokmil',
  'sokmil': 'sokmil',
  'SOKMIL': 'sokmil',
  'ソクミル': 'sokmil',
  'DTI': 'dti',
  'dti': 'dti',
  'MGS': 'mgs',
  'mgs': 'mgs',
  'MGS動画': 'mgs',
  'b10f': 'b10f',
  'B10F': 'b10f',
  'FC2': 'fc2',
  'fc2': 'fc2',
  'Japanska': 'japanska',
  'japanska': 'japanska',
  'FANZA': 'fanza',
  'fanza': 'fanza',
  'DMM': 'fanza',
  // DTI個別サービス（英語キー）
  'caribbeancom': 'caribbeancom',
  'caribbeancompr': 'caribbeancompr',
  '1pondo': '1pondo',
  'heyzo': 'heyzo',
  '10musume': '10musume',
  'pacopacomama': 'pacopacomama',
  'muramura': 'muramura',
  'tokyohot': 'tokyohot',
  // DTI個別サービス（日本語キー - DB保存名）
  'カリビアンコム': 'caribbeancom',
  'カリビアンコムプレミアム': 'caribbeancompr',
  '一本道': '1pondo',
  'HEYZO': 'heyzo',
  '天然むすめ': '10musume',
  'パコパコママ': 'pacopacomama',
  'ムラムラ': 'muramura',
  '人妻斬り': 'muramura', // hitozumagiriはmuramuraにマップ
  '金髪天國': 'tokyohot', // kin8tengokuはtokyohotにマップ
};

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
  return {
    min: minStr ? parseInt(minStr, 10) : undefined,
    max: maxStr ? parseInt(maxStr, 10) : undefined,
  };
}

// ============================================================
// 出演者タイプ
// ============================================================

/**
 * 出演者タイプ
 */
export type PerformerType = 'solo' | 'multi';

/**
 * 出演者タイプのラベル
 */
export const PERFORMER_TYPE_OPTIONS: { value: PerformerType | ''; label: string }[] = [
  { value: '', label: 'すべて' },
  { value: 'solo', label: '単体作品' },
  { value: 'multi', label: '複数出演' },
];
