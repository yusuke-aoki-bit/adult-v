/**
 * ASP名正規化ユーティリティ
 *
 * DTI URL判定、日本語名変換、大文字正規化を統合
 * 両アプリ（web/fanza）で共通使用
 *
 * 定数はすべて asp-registry.ts から導出。
 * このファイルは関数のみ提供し、既存のimportパスとの後方互換性を維持する。
 */

// レジストリから定数を re-export
export {
  DTI_URL_PATTERNS,
  JA_TO_EN_MAP,
  UPPER_TO_LOWER_MAP,
  ASP_DISPLAY_NAMES,
  VALID_ASP_NAMES,
  ASP_BADGE_COLORS,
} from '../asp-registry';

import {
  DTI_URL_PATTERNS,
  JA_TO_EN_MAP,
  UPPER_TO_LOWER_MAP,
  ASP_DISPLAY_NAMES,
  VALID_ASP_NAMES,
  ASP_BADGE_COLORS,
  DTI_SUB_SERVICE_IDS,
} from '../asp-registry';

// ============================================================
// メイン関数
// ============================================================

/**
 * ASP名を正規化
 *
 * @param aspName - 元のASP名（大文字、日本語、DTI等）
 * @param productUrl - 商品URL（DTIサブサービス判定用、省略可）
 * @returns 正規化されたASP名（小文字英語）
 *
 * @example
 * normalizeAspName('FANZA') // => 'fanza'
 * normalizeAspName('カリビアンコム') // => 'caribbeancom'
 * normalizeAspName('DTI', 'https://www.caribbeancom.com/...') // => 'caribbeancom'
 */
export function normalizeAspName(aspName: string, productUrl?: string): string {
  // DTI の場合はURLから具体的なサブサービスを判定
  if (aspName === 'DTI' && productUrl) {
    for (const [pattern, normalized] of Object.entries(DTI_URL_PATTERNS)) {
      if (productUrl.includes(pattern)) {
        return normalized;
      }
    }
    return 'dti';
  }

  // 日本語名チェック
  if (JA_TO_EN_MAP[aspName]) {
    return JA_TO_EN_MAP[aspName];
  }

  // 大文字名チェック
  if (UPPER_TO_LOWER_MAP[aspName]) {
    return UPPER_TO_LOWER_MAP[aspName];
  }

  // デフォルト: 小文字化
  return aspName.toLowerCase();
}

/**
 * ASP名から表示用名称を取得
 *
 * @param aspName - 正規化されたASP名または元のASP名
 * @returns 表示用名称
 *
 * @example
 * getAspDisplayName('fanza') // => 'FANZA'
 * getAspDisplayName('caribbeancom') // => 'カリビアンコム'
 */
export function getAspDisplayName(aspName: string): string {
  const normalized = normalizeAspName(aspName);
  return ASP_DISPLAY_NAMES[normalized] || aspName;
}

/**
 * 有効なASP名かどうかを判定
 *
 * @param aspName - チェックするASP名
 * @returns 有効な場合はtrue
 */
export function isValidAspName(aspName: string): boolean {
  const normalized = normalizeAspName(aspName);
  return VALID_ASP_NAMES.has(normalized);
}

/**
 * DTI系サブサービスかどうかを判定
 *
 * @param aspName - チェックするASP名
 * @returns DTI系の場合はtrue
 */
export function isDtiSubService(aspName: string): boolean {
  const normalized = normalizeAspName(aspName);
  return DTI_SUB_SERVICE_IDS.includes(normalized) || normalized === 'dti';
}

// ============================================================
// SQL用ヘルパー（Drizzle ORM用）
// ============================================================

/**
 * ASP名正規化のためのSQL CASE式を生成
 * クエリ内で使用するためのヘルパー
 *
 * @param aspNameColumn - ASP名カラム参照
 * @param urlColumn - URL カラム参照（DTI判定用）
 * @returns SQL CASE式の文字列
 */
export function generateAspNormalizationCase(): string {
  // DTI URL判定部分
  const dtiUrlCases = Object.entries(DTI_URL_PATTERNS)
    .map(([pattern, normalized]) => `WHEN url LIKE '%${pattern}%' THEN '${normalized}'`)
    .join('\n                  ');

  // 日本語名変換部分
  const jaCases = Object.entries(JA_TO_EN_MAP)
    .map(([ja, en]) => `WHEN asp_name = '${ja}' THEN '${en}'`)
    .join('\n              ');

  // 大文字名変換部分
  const upperCases = Object.entries(UPPER_TO_LOWER_MAP)
    .map(([upper, lower]) => `WHEN asp_name = '${upper}' THEN '${lower}'`)
    .join('\n              ');

  return `
    CASE
      WHEN asp_name = 'DTI' THEN
        CASE
          ${dtiUrlCases}
          ELSE 'dti'
        END
      ${jaCases}
      ${upperCases}
      ELSE LOWER(asp_name)
    END
  `.trim();
}

/**
 * 指定されたASP名リストに一致するか判定するSQL条件を生成
 *
 * @param aspNames - 正規化されたASP名リスト
 * @returns SQL条件文字列
 */
export function generateAspMatchCondition(aspNames: string[]): string {
  const quoted = aspNames.map(name => `'${name}'`).join(', ');
  return `(${generateAspNormalizationCase()}) IN (${quoted})`;
}

// ============================================================
// SQL CASE式パーツ（Drizzle raw SQL用）
// ============================================================

/**
 * DTI URL判定のCASE WHENパーツを生成（カラム名指定可能）
 * @param urlColumnRef - URLカラム参照（例: 'p.default_thumbnail_url', 'ps.url'）
 * @returns DTI CASE WHEN文字列
 */
export function buildDtiUrlCaseParts(urlColumnRef: string): string {
  return Object.entries(DTI_URL_PATTERNS)
    .map(([pattern, normalized]) =>
      `WHEN ${urlColumnRef} LIKE '%${pattern}%' THEN '${normalized}'`
    )
    .join('\n                  ');
}

/**
 * 日本語名変換のCASE WHENパーツを生成（カラム名指定可能）
 * @param aspColumnRef - ASP名カラム参照（例: 'ps.asp_name'）
 * @returns 日本語→英語変換のCASE WHEN文字列
 */
export function buildJaToEnCaseParts(aspColumnRef: string): string {
  return Object.entries(JA_TO_EN_MAP)
    .map(([ja, en]) => `WHEN ${aspColumnRef} = '${ja}' THEN '${en}'`)
    .join('\n              ');
}

/**
 * 大文字→小文字変換のCASE WHENパーツを生成（カラム名指定可能）
 * @param aspColumnRef - ASP名カラム参照（例: 'ps.asp_name'）
 * @returns 大文字→小文字変換のCASE WHEN文字列
 */
export function buildUpperToLowerCaseParts(aspColumnRef: string): string {
  return Object.entries(UPPER_TO_LOWER_MAP)
    .map(([upper, lower]) => `WHEN ${aspColumnRef} = '${upper}' THEN '${lower}'`)
    .join('\n              ');
}

/**
 * 完全なASP正規化CASE式を生成（カラム名指定可能）
 * @param aspColumnRef - ASP名カラム参照（例: 'ps.asp_name'）
 * @param urlColumnRef - URLカラム参照（例: 'p.default_thumbnail_url'）
 * @returns 完全なCASE式文字列
 */
export function buildAspNormalizationSql(
  aspColumnRef: string,
  urlColumnRef: string
): string {
  const dtiUrlCases = buildDtiUrlCaseParts(urlColumnRef);
  const jaCases = buildJaToEnCaseParts(aspColumnRef);
  const upperCases = buildUpperToLowerCaseParts(aspColumnRef);

  return `CASE
              WHEN ${aspColumnRef} = 'DTI' THEN
                CASE
                  ${dtiUrlCases}
                  ELSE 'dti'
                END
              ${jaCases}
              ${upperCases}
              ELSE LOWER(${aspColumnRef})
            END`;
}

/**
 * ASP正規化CASE式をIN句と組み合わせたSQL条件を生成
 * @param aspColumnRef - ASP名カラム参照
 * @param urlColumnRef - URLカラム参照
 * @param aspNames - マッチさせたい正規化済みASP名リスト
 * @returns IN句付きCASE式文字列
 */
export function buildAspMatchSql(
  aspColumnRef: string,
  urlColumnRef: string,
  aspNames: string[]
): string {
  const quoted = aspNames.map(name => `'${name}'`).join(', ');
  return `(${buildAspNormalizationSql(aspColumnRef, urlColumnRef)}) IN (${quoted})`;
}

// ============================================================
// ASPバッジカラー
// ============================================================

/**
 * ASPバッジカラーを取得
 * @param aspName - ASP名（正規化済みまたは元の名前）
 * @returns Tailwind CSSクラス
 */
export function getAspBadgeColor(aspName: string): { bg: string; text: string; border: string } {
  const normalized = normalizeAspName(aspName);
  const color = ASP_BADGE_COLORS[normalized];
  return color ?? ASP_BADGE_COLORS['default']!;
}
