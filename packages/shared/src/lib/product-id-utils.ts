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
  'FANZA',
  'MGS',
  'DUGA',
  'SOKMIL',
  'B10F',
  'FC2',
  'JAPANSKA',
  'CARIBBEAN',
  'CARIBBEANCOMPR',
  '1PONDO',
  'HEYZO',
  '10MUSUME',
  'PACOPACOMAMA',
  'H4610',
  'H0930',
  'C0930',
  'GACHINCO',
  'KIN8TENGOKU',
  'NYOSHIN',
  'HEYDOUGA',
  'X1X',
  'ENKOU55',
  'UREKKO',
  'XXXURABI',
  'TOKYOHOT',
  'TVDEAV',
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
    if (standardMatch?.[1] && standardMatch[2]) {
      const prefix = standardMatch[1];
      const num = parseInt(standardMatch[2], 10);
      addPaddingVariations(variations, prefix, num);
    }

    // FANZA特有の品番パターン: prefix + 5桁数字（例: mide00001）
    const fanzaMatch = baseId.match(/^([a-zA-Z]+)(\d{5})$/i);
    if (fanzaMatch?.[1] && fanzaMatch[2]) {
      const prefix = fanzaMatch[1];
      const num = parseInt(fanzaMatch[2], 10);
      addPaddingVariations(variations, prefix, num);
      // FANZAプレフィックス付きも追加
      variations.add(`FANZA-${prefix.toLowerCase()}${fanzaMatch[2]}`);
      variations.add(`fanza-${prefix.toLowerCase()}${fanzaMatch[2]}`);
    }

    // MGS特有の品番パターン: 数字prefix + アルファベット + 数字（例: 259LUXU-1234）
    const mgsMatch = baseId.match(/^(\d+)([a-zA-Z]+)[-_]?(\d+)$/);
    if (mgsMatch?.[1] && mgsMatch[2] && mgsMatch[3]) {
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
    if (tmpMatch?.[1] && tmpMatch[2] && tmpMatch[3]) {
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
    if (dtiMatch?.[1] && dtiMatch[2]) {
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

/**
 * 品番を表示用にフォーマット（正規化）
 *
 * 様々なフォーマットの品番を「PREFIX-NUMBER」形式に統一
 * 先頭の数字プレフィックス（メーカーコード）を除去
 *
 * @example
 * formatProductCodeForDisplay('107START-470')  // 'START-470'
 * formatProductCodeForDisplay('ssis00865')     // 'SSIS-865'
 * formatProductCodeForDisplay('h_1234abc00123') // 'ABC-123'
 * formatProductCodeForDisplay('300mium01359')  // '300MIUM-1359'
 */
export function formatProductCodeForDisplay(code: string | null | undefined): string | null {
  if (!code || typeof code !== 'string') return null;

  let input = code.trim().toUpperCase();
  if (!input) return null;

  // h_XXXX プレフィックス除去 (FANZA特有)
  // 例: H_1234ABC00123 → ABC00123
  input = input.replace(/^H_\d+/, '');

  // 3桁数字+英字 の場合は数字プレフィックスを除去しない（シロウトTV系）
  // 例: 300MIUM-1359 → そのまま
  const is300series = input.match(/^300[A-Z]+/);

  if (!is300series) {
    // その他の数字プレフィックスを除去
    // 例: 107START-470 → START-470
    // 例: 118ABW00123 → ABW00123
    input = input.replace(/^\d+(?=[A-Z])/, '');
  }

  // パターン1: 既にハイフン区切り (SSIS-865, 300MIUM-1359, START-470)
  let match = input.match(/^(\d*[A-Z]+)-(\d+)$/);
  if (match?.[1] && match[2]) {
    const prefix = match[1];
    const number = match[2].replace(/^0+/, '') || '0';
    return `${prefix}-${number}`;
  }

  // パターン2: ハイフンなし、数字プレフィックス付き (300MIUM1359)
  match = input.match(/^(\d+[A-Z]+)(\d+)$/);
  if (match?.[1] && match[2]) {
    const prefix = match[1];
    const number = match[2].replace(/^0+/, '') || '0';
    return `${prefix}-${number}`;
  }

  // パターン3: ハイフンなし、英字のみプレフィックス (SSIS00865 → SSIS-865)
  match = input.match(/^([A-Z]+)(\d+)$/);
  if (match?.[1] && match[2]) {
    const prefix = match[1];
    const number = match[2].replace(/^0+/, '') || '0';
    return `${prefix}-${number}`;
  }

  // 解析失敗 - 元の値をそのまま返す
  return code.toUpperCase();
}
