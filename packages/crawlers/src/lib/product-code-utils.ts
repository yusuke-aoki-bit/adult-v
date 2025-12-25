/**
 * 商品品番（Product Code）ユーティリティ
 *
 * AVメーカー品番を正規化し、ASP間で統一されたIDとして使用可能にする
 *
 * 品番形式例:
 * - SSIS-865 (S1 NO.1 STYLE)
 * - MIDV-001 (MOODYZ)
 * - 300MIUM-1000 (シロウトTV)
 * - ABW-123 (プレステージ)
 * - FSDSS-456 (FALENO)
 */

/**
 * 品番パースの結果
 */
export interface ParsedProductCode {
  /** 正規化された品番 (例: SSIS-865) */
  normalized: string;
  /** シリーズ/レーベルプレフィックス (例: SSIS) */
  prefix: string;
  /** 番号部分 (例: 865) */
  number: string;
  /** オリジナル入力 */
  original: string;
}

/**
 * 品番を正規化
 *
 * 様々なフォーマットの品番を「PREFIX-NUMBER」形式に統一
 *
 * @example
 * normalizeProductCode('ssis00865') // => 'SSIS-865'
 * normalizeProductCode('SSIS-865') // => 'SSIS-865'
 * normalizeProductCode('300mium01359') // => '300MIUM-1359'
 * normalizeProductCode('h_1234abc00123') // => 'ABC-123'
 */
export function normalizeProductCode(code: string): string | null {
  if (!code || typeof code !== 'string') return null;

  const trimmed = code.trim();
  if (!trimmed) return null;

  const parsed = parseProductCode(trimmed);
  return parsed?.normalized ?? null;
}

/**
 * 品番を解析
 *
 * @param code 品番文字列
 * @returns パース結果、または解析失敗時はnull
 */
export function parseProductCode(code: string): ParsedProductCode | null {
  if (!code || typeof code !== 'string') return null;

  let input = code.trim().toUpperCase();

  // 空文字チェック
  if (!input) return null;

  // h_XXXX プレフィックス除去 (FANZA特有)
  // 例: h_1234abc00123 → abc00123
  input = input.replace(/^H_\d+/, '');

  // その他の一般的なプレフィックス除去
  // 例: 118abw00123 → abw00123
  input = input.replace(/^\d{3}(?=[A-Z])/, '');

  // パターン1: 既にハイフン区切り (SSIS-865, 300MIUM-1359)
  let match = input.match(/^(\d*[A-Z]+)-(\d+)$/);
  if (match) {
    const prefix = match[1];
    const number = match[2].replace(/^0+/, '') || '0';
    return {
      normalized: `${prefix}-${number}`,
      prefix,
      number,
      original: code,
    };
  }

  // パターン2: ハイフンなし、数字プレフィックス付き (300MIUM1359)
  match = input.match(/^(\d+[A-Z]+)(\d+)$/);
  if (match) {
    const prefix = match[1];
    const number = match[2].replace(/^0+/, '') || '0';
    return {
      normalized: `${prefix}-${number}`,
      prefix,
      number,
      original: code,
    };
  }

  // パターン3: ハイフンなし、英字のみプレフィックス (ssis00865 → SSIS-865)
  match = input.match(/^([A-Z]+)(\d+)$/);
  if (match) {
    const prefix = match[1];
    const number = match[2].replace(/^0+/, '') || '0';
    return {
      normalized: `${prefix}-${number}`,
      prefix,
      number,
      original: code,
    };
  }

  // パターン4: 複合形式 (1sdab00123 → SDAB-123)
  // 先頭の数字1桁を除去
  const stripped = input.replace(/^1/, '');
  match = stripped.match(/^([A-Z]+)(\d+)$/);
  if (match) {
    const prefix = match[1];
    const number = match[2].replace(/^0+/, '') || '0';
    return {
      normalized: `${prefix}-${number}`,
      prefix,
      number,
      original: code,
    };
  }

  // 解析失敗
  return null;
}

/**
 * FANZA Content ID (cid) から品番を抽出
 *
 * FANZAのcidは以下の形式を取る:
 * - 単純形式: ssis00865 → SSIS-865
 * - プレフィックス付き: h_1234abc00123 → ABC-123
 * - 数字プレフィックス: 300mium01359 → 300MIUM-1359
 * - メーカープレフィックス: 118abw00123 → ABW-123
 *
 * @param cid FANZA Content ID
 * @returns 正規化された品番、または抽出失敗時はnull
 */
export function extractProductCodeFromFanzaCid(cid: string): string | null {
  if (!cid || typeof cid !== 'string') return null;

  // cidを大文字に統一して解析
  return normalizeProductCode(cid);
}

/**
 * 品番が有効かどうかをチェック
 *
 * @param code 品番文字列
 * @returns 有効な品番フォーマットの場合true
 */
export function isValidProductCode(code: string): boolean {
  return parseProductCode(code) !== null;
}

/**
 * 2つの品番が同じ作品を指すかどうかを比較
 *
 * @param code1 品番1
 * @param code2 品番2
 * @returns 同じ作品の場合true
 */
export function isSameProduct(code1: string, code2: string): boolean {
  const normalized1 = normalizeProductCode(code1);
  const normalized2 = normalizeProductCode(code2);

  if (!normalized1 || !normalized2) return false;

  return normalized1 === normalized2;
}

/**
 * 品番からシリーズプレフィックスを抽出
 *
 * @param code 品番文字列
 * @returns シリーズプレフィックス (例: SSIS, MIDV, 300MIUM)
 */
export function extractSeriesPrefix(code: string): string | null {
  const parsed = parseProductCode(code);
  return parsed?.prefix ?? null;
}

/**
 * シリーズプレフィックスとメーカーのマッピング
 * (一部の有名レーベルのみ)
 */
export const SERIES_MAKER_MAP: Record<string, string> = {
  // S1 NO.1 STYLE
  SSIS: 'S1 NO.1 STYLE',
  SSNI: 'S1 NO.1 STYLE',
  OFJE: 'S1 NO.1 STYLE',

  // MOODYZ
  MIDV: 'MOODYZ',
  MIDE: 'MOODYZ',
  MIFD: 'MOODYZ',

  // SODクリエイト
  STARS: 'SODクリエイト',
  STAR: 'SODクリエイト',
  SDAB: 'SODクリエイト',
  SDJS: 'SODクリエイト',
  SDAM: 'SODクリエイト',
  SDMU: 'SODクリエイト',
  SDNM: 'SODクリエイト',

  // Ideapocket
  IPX: 'Ideapocket',
  IPZ: 'Ideapocket',
  IPIT: 'Ideapocket',

  // kawaii
  CAWD: 'kawaii',
  KWBD: 'kawaii',

  // プレステージ
  ABW: 'プレステージ',
  ABP: 'プレステージ',
  ABS: 'プレステージ',
  ABF: 'プレステージ',
  CHN: 'プレステージ',
  TEM: 'プレステージ',
  SGA: 'プレステージ',

  // シロウトTV / MGS系
  '300MIUM': 'シロウトTV',
  '300MAAN': 'シロウトTV',
  '300NTK': 'シロウトTV',
  '261ARA': 'ARA〜あら〜',
  '259LUXU': 'ラグジュTV',

  // FALENO
  FSDSS: 'FALENO',
  FLNS: 'FALENO',

  // Attackers
  SHKD: 'Attackers',
  ADN: 'Attackers',
  ATID: 'Attackers',

  // Madonna
  JUL: 'Madonna',
  JUQ: 'Madonna',
  JUY: 'Madonna',
  ROE: 'Madonna',
  OBA: 'Madonna',
};

/**
 * 品番からメーカー名を推定
 *
 * @param code 品番文字列
 * @returns メーカー名、または不明な場合はnull
 */
export function inferMakerFromProductCode(code: string): string | null {
  const prefix = extractSeriesPrefix(code);
  if (!prefix) return null;

  return SERIES_MAKER_MAP[prefix] ?? null;
}
