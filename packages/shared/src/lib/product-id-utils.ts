/**
 * 品番（Product ID）関連のユーティリティ
 *
 * 品番の正規化、バリエーション生成などを行う
 * 例: MIDE-001, mide001, MIDE001 などの表記ゆれを吸収
 *
 * サポートパターン:
 * - FANZA: MIDE-001, mide00001, FANZA-mide00001
 * - MGS: 259luxu-1234, 259LUXU1234
 * - DTI: 123456_01, CARIBBEAN-123456
 * - TMP: 4037-PPV2543, HEYDOUGA-4037-PPV2543
 */

/** ASPプレフィックス一覧（検索時に除去して検索に含める） */
const ASP_PREFIXES = [
  'FANZA', 'MGS', 'DUGA', 'SOKMIL', 'B10F', 'FC2', 'JAPANSKA',
  'CARIBBEAN', 'CARIBBEANCOMPR', '1PONDO', 'HEYZO', '10MUSUME',
  'PACOPACOMAMA', 'H4610', 'H0930', 'C0930', 'GACHINCO',
  'KIN8TENGOKU', 'NYOSHIN',
  'HEYDOUGA', 'X1X', 'ENKOU55', 'UREKKO', 'XXXURABI',
  'TOKYOHOT', 'TVDEAV',
];

/**
 * 品番を正規化（検索用）
 * - 小文字に変換
 * - ハイフン・アンダースコアを除去
 * - 先頭のゼロを保持
 *
 * @example
 * normalizeProductIdForSearch('MIDE-001')  // 'mide001'
 * normalizeProductIdForSearch('ABP_001')   // 'abp001'
 * normalizeProductIdForSearch('FANZA-mide00001')  // 'fanzamide00001'
 */
export function normalizeProductIdForSearch(id: string): string {
  return id
    .trim()
    .toLowerCase()
    .replace(/[-_\s]/g, '');
}

/**
 * ASPプレフィックスを除去
 *
 * @example
 * stripAspPrefix('FANZA-mide00001')  // 'mide00001'
 * stripAspPrefix('CARIBBEAN-123456')  // '123456'
 */
export function stripAspPrefix(id: string): string {
  const upper = id.toUpperCase();
  for (const prefix of ASP_PREFIXES) {
    if (upper.startsWith(prefix + '-')) {
      return id.slice(prefix.length + 1);
    }
  }
  return id;
}

/**
 * 品番のバリエーションを生成
 * ハイフンあり/なし、大文字/小文字、ゼロパディング、ASPプレフィックスなどのパターンを生成
 *
 * @example
 * generateProductIdVariations('MIDE-001')
 * // ['MIDE-001', 'mide-001', 'MIDE001', 'mide001', 'mide00001', 'FANZA-mide00001', ...]
 *
 * generateProductIdVariations('259LUXU-1234')
 * // ['259LUXU-1234', '259luxu-1234', '259luxu1234', ...]
 */
export function generateProductIdVariations(id: string): string[] {
  const variations = new Set<string>();
  const trimmed = id.trim();

  // ASPプレフィックスを除去したバージョンも処理
  const strippedId = stripAspPrefix(trimmed);
  const idsToProcess = strippedId !== trimmed ? [trimmed, strippedId] : [trimmed];

  for (const baseId of idsToProcess) {
    // オリジナル（そのまま）
    variations.add(baseId);

    // 小文字版
    variations.add(baseId.toLowerCase());

    // 大文字版
    variations.add(baseId.toUpperCase());

    // ハイフン・アンダースコアなし
    const noSeparator = baseId.replace(/[-_]/g, '');
    variations.add(noSeparator);
    variations.add(noSeparator.toLowerCase());
    variations.add(noSeparator.toUpperCase());

    // 数字の前にハイフンを挿入（abc001 -> abc-001）
    const withHyphen = baseId.replace(/([a-zA-Z]+)(\d+)/g, '$1-$2');
    if (withHyphen !== baseId) {
      variations.add(withHyphen);
      variations.add(withHyphen.toLowerCase());
      variations.add(withHyphen.toUpperCase());
    }

    // 標準的な品番パターン: PREFIX-NUMBER（例: MIDE-001, ABP-123）
    const standardMatch = baseId.match(/^([a-zA-Z]+)[-_]?(\d+)$/);
    if (standardMatch) {
      const prefix = standardMatch[1];
      const num = parseInt(standardMatch[2], 10);
      addPaddingVariations(variations, prefix, num);
    }

    // FANZA特有の品番パターン: prefix + 5桁数字（例: mide00001）
    const fanzaMatch = baseId.match(/^([a-zA-Z]+)(\d{5})$/i);
    if (fanzaMatch) {
      const prefix = fanzaMatch[1];
      const num = parseInt(fanzaMatch[2], 10);
      addPaddingVariations(variations, prefix, num);
      // FANZAプレフィックス付きも追加
      variations.add(`FANZA-${prefix.toLowerCase()}${fanzaMatch[2]}`);
      variations.add(`fanza-${prefix.toLowerCase()}${fanzaMatch[2]}`);
    }

    // MGS特有の品番パターン: 数字prefix + アルファベット + 数字（例: 259LUXU-1234）
    const mgsMatch = baseId.match(/^(\d+)([a-zA-Z]+)[-_]?(\d+)$/);
    if (mgsMatch) {
      const numPrefix = mgsMatch[1];
      const letterPart = mgsMatch[2];
      const numSuffix = mgsMatch[3];

      // バリエーション生成
      variations.add(`${numPrefix}${letterPart}-${numSuffix}`);
      variations.add(`${numPrefix}${letterPart.toLowerCase()}-${numSuffix}`);
      variations.add(`${numPrefix}${letterPart}${numSuffix}`);
      variations.add(`${numPrefix}${letterPart.toLowerCase()}${numSuffix}`);
    }

    // TMP特有のパターン: 数字-PPV数字（例: 4037-PPV2543）
    const tmpMatch = baseId.match(/^(\d+)[-_]?(PPV|ppv)(\d+)$/i);
    if (tmpMatch) {
      const num1 = tmpMatch[1];
      const ppv = tmpMatch[2];
      const num2 = tmpMatch[3];
      variations.add(`${num1}-${ppv.toUpperCase()}${num2}`);
      variations.add(`${num1}-${ppv.toLowerCase()}${num2}`);
      variations.add(`${num1}${ppv.toUpperCase()}${num2}`);
      variations.add(`${num1}${ppv.toLowerCase()}${num2}`);
    }

    // DTI特有のパターン: 数字_数字（例: 123456_01）
    const dtiMatch = baseId.match(/^(\d+)_(\d+)$/);
    if (dtiMatch) {
      const mainNum = dtiMatch[1];
      const subNum = dtiMatch[2];
      variations.add(`${mainNum}_${subNum}`);
      variations.add(`${mainNum}-${subNum}`);
      variations.add(`${mainNum}${subNum}`);
    }
  }

  return Array.from(variations);
}

/**
 * ゼロパディングのバリエーションを追加（内部ヘルパー）
 */
function addPaddingVariations(variations: Set<string>, prefix: string, num: number): void {
  const numStr = String(num);
  const padded3 = numStr.padStart(3, '0');
  const padded5 = numStr.padStart(5, '0');

  // パディングなし
  variations.add(`${prefix}-${numStr}`);
  variations.add(`${prefix.toLowerCase()}-${numStr}`);
  variations.add(`${prefix.toUpperCase()}-${numStr}`);
  variations.add(`${prefix}${numStr}`);
  variations.add(`${prefix.toLowerCase()}${numStr}`);
  variations.add(`${prefix.toUpperCase()}${numStr}`);

  // 3桁パディング（DVD品番標準）
  if (padded3 !== numStr) {
    variations.add(`${prefix}-${padded3}`);
    variations.add(`${prefix.toLowerCase()}-${padded3}`);
    variations.add(`${prefix.toUpperCase()}-${padded3}`);
    variations.add(`${prefix}${padded3}`);
    variations.add(`${prefix.toLowerCase()}${padded3}`);
    variations.add(`${prefix.toUpperCase()}${padded3}`);
  }

  // 5桁パディング（FANZA標準）
  if (padded5 !== numStr && padded5 !== padded3) {
    variations.add(`${prefix}-${padded5}`);
    variations.add(`${prefix.toLowerCase()}-${padded5}`);
    variations.add(`${prefix.toUpperCase()}-${padded5}`);
    variations.add(`${prefix}${padded5}`);
    variations.add(`${prefix.toLowerCase()}${padded5}`);
    variations.add(`${prefix.toUpperCase()}${padded5}`);
  }
}

/**
 * 品番がパターンに一致するか（正規化して比較）
 *
 * @example
 * matchProductId('MIDE-001', 'mide001')  // true
 * matchProductId('ABP-123', 'ABP123')    // true
 */
export function matchProductId(id1: string, id2: string): boolean {
  return normalizeProductIdForSearch(id1) === normalizeProductIdForSearch(id2);
}

/**
 * 品番から正規表現パターンを生成（SQL LIKE用）
 * ハイフンの有無を許容するパターンを生成
 *
 * @example
 * productIdToLikePattern('MIDE-001')  // 'mide%001'
 */
export function productIdToLikePattern(id: string): string {
  const normalized = id.trim().toLowerCase();
  // 英字と数字の間にワイルドカードを挿入
  return normalized.replace(/([a-z]+)[-_]?(\d+)/, '$1%$2');
}
