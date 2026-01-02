/**
 * ASP名正規化ユーティリティ
 *
 * DTI URL判定、日本語名変換、大文字正規化を統合
 * 両アプリ（web/fanza）で共通使用
 */

// ============================================================
// DTI URL → ASP名マッピング
// ============================================================

/**
 * DTI系サブサービスのURLパターン
 * key: URLに含まれる文字列
 * value: 正規化されたASP名
 */
export const DTI_URL_PATTERNS: Record<string, string> = {
  'caribbeancompr.com': 'caribbeancompr',
  'caribbeancom.com': 'caribbeancom',
  '1pondo.tv': '1pondo',
  'heyzo.com': 'heyzo',
  '10musume.com': '10musume',
  'pacopacomama.com': 'pacopacomama',
  'muramura.tv': 'muramura',
  'tokyo-hot.com': 'tokyohot',
  'heydouga.com': 'heydouga',
  'x1x.com': 'x1x',
  'av9898.com': 'av9898',
  'honnamatv.com': 'honnamatv',
  'enkou55.com': 'enkou55',
  'urekko': 'urekko',
  'tvdeav': 'tvdeav',
};

// ============================================================
// 日本語名 → 英語名マッピング
// ============================================================

/**
 * 日本語ASP名から正規化された英語名へのマッピング
 */
export const JA_TO_EN_MAP: Record<string, string> = {
  'カリビアンコムプレミアム': 'caribbeancompr',
  'カリビアンコムPR': 'caribbeancompr',
  'カリビアンコム': 'caribbeancom',
  '一本道': '1pondo',
  '天然むすめ': '10musume',
  'パコパコママ': 'pacopacomama',
  'ムラムラ': 'muramura',
  'ムラムラってくる素人': 'muramura',
  'Tokyo Hot': 'tokyohot',
  'トウキョウホット': 'tokyohot',
};

// ============================================================
// 大文字 → 小文字マッピング
// ============================================================

/**
 * 大文字ASP名から小文字正規化名へのマッピング
 */
export const UPPER_TO_LOWER_MAP: Record<string, string> = {
  'SOKMIL': 'sokmil',
  'DUGA': 'duga',
  'FANZA': 'fanza',
  'MGS': 'mgs',
  'FC2': 'fc2',
  'Japanska': 'japanska',
  'JAPANSKA': 'japanska',
  'CARIBBEANCOM': 'caribbeancom',
  'CARIBBEANCOMPR': 'caribbeancompr',
  'HEYZO': 'heyzo',
  'HEYDOUGA': 'heydouga',
  'X1X': 'x1x',
  'ENKOU55': 'enkou55',
  'UREKKO': 'urekko',
  'TVDEAV': 'tvdeav',
  'TOKYOHOT': 'tokyohot',
  '1PONDO': '1pondo',
  '10MUSUME': '10musume',
  'PACOPACOMAMA': 'pacopacomama',
  'MURAMURA': 'muramura',
  'DTI': 'dti',
};

// ============================================================
// 表示名マッピング
// ============================================================

/**
 * 正規化ASP名から表示用名称へのマッピング
 */
export const ASP_DISPLAY_NAMES: Record<string, string> = {
  'fanza': 'FANZA',
  'duga': 'DUGA',
  'sokmil': 'SOKMIL',
  'mgs': 'MGS動画',
  'fc2': 'FC2',
  'caribbeancom': 'カリビアンコム',
  'caribbeancompr': 'カリビアンコムPR',
  '1pondo': '一本道',
  'heyzo': 'HEYZO',
  '10musume': '天然むすめ',
  'pacopacomama': 'パコパコママ',
  'muramura': 'ムラムラ',
  'tokyohot': 'Tokyo Hot',
  'heydouga': 'Hey動画',
  'x1x': 'X1X',
  'av9898': 'AV9898',
  'honnamatv': 'ホンナマTV',
  'enkou55': 'エンコウ55',
  'urekko': 'ウレッコ',
  'tvdeav': 'TVDEAV',
  'japanska': 'Japanska',
  'dti': 'DTI',
  'b10f': 'B10F',
};

// ============================================================
// 有効なASP名リスト
// ============================================================

/**
 * 有効なASP名（正規化済み）のリスト
 */
export const VALID_ASP_NAMES = new Set([
  'fanza',
  'duga',
  'sokmil',
  'mgs',
  'fc2',
  'caribbeancom',
  'caribbeancompr',
  '1pondo',
  'heyzo',
  '10musume',
  'pacopacomama',
  'muramura',
  'tokyohot',
  'heydouga',
  'x1x',
  'av9898',
  'honnamatv',
  'enkou55',
  'urekko',
  'tvdeav',
  'japanska',
  'dti',
  'b10f',
]);

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
  const dtiServices = [
    'caribbeancom',
    'caribbeancompr',
    '1pondo',
    'heyzo',
    '10musume',
    'pacopacomama',
    'muramura',
    'tokyohot',
    'heydouga',
    'x1x',
    'av9898',
    'honnamatv',
    'enkou55',
    'urekko',
    'tvdeav',
    'dti',
  ];
  return dtiServices.includes(normalized);
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
// ASPバッジカラー（統一された色定義）
// ============================================================

/**
 * ASPバッジの背景色（Tailwind CSSクラス）
 */
export const ASP_BADGE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  // 大手サイト
  fanza: { bg: 'bg-pink-600', text: 'text-white', border: 'border-pink-500' },
  mgs: { bg: 'bg-blue-600', text: 'text-white', border: 'border-blue-500' },
  duga: { bg: 'bg-orange-600', text: 'text-white', border: 'border-orange-500' },
  sokmil: { bg: 'bg-purple-600', text: 'text-white', border: 'border-purple-500' },
  fc2: { bg: 'bg-red-600', text: 'text-white', border: 'border-red-500' },

  // DTI系（カリビアン・無修正系）
  caribbeancom: { bg: 'bg-teal-600', text: 'text-white', border: 'border-teal-500' },
  caribbeancompr: { bg: 'bg-teal-700', text: 'text-white', border: 'border-teal-600' },
  '1pondo': { bg: 'bg-cyan-600', text: 'text-white', border: 'border-cyan-500' },
  heyzo: { bg: 'bg-sky-600', text: 'text-white', border: 'border-sky-500' },
  '10musume': { bg: 'bg-rose-600', text: 'text-white', border: 'border-rose-500' },
  pacopacomama: { bg: 'bg-fuchsia-600', text: 'text-white', border: 'border-fuchsia-500' },
  tokyohot: { bg: 'bg-red-700', text: 'text-white', border: 'border-red-600' },

  // その他
  heydouga: { bg: 'bg-amber-600', text: 'text-white', border: 'border-amber-500' },
  japanska: { bg: 'bg-indigo-600', text: 'text-white', border: 'border-indigo-500' },
  b10f: { bg: 'bg-emerald-600', text: 'text-white', border: 'border-emerald-500' },

  // デフォルト
  default: { bg: 'bg-gray-600', text: 'text-white', border: 'border-gray-500' },
};

/**
 * ASPバッジカラーを取得
 * @param aspName - ASP名（正規化済みまたは元の名前）
 * @returns Tailwind CSSクラス
 */
export function getAspBadgeColor(aspName: string): { bg: string; text: string; border: string } {
  const normalized = normalizeAspName(aspName);
  return ASP_BADGE_COLORS[normalized] || ASP_BADGE_COLORS.default;
}
