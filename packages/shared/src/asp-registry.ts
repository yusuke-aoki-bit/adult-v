/**
 * ASPレジストリ — 全ASPメタデータの単一真実源
 *
 * 新しいASPを追加する場合はこのファイルのASP_REGISTRYに1エントリ追加するだけでOK。
 * 他ファイルの定数・型は全てここから自動導出される。
 */

// ============================================================
// レジストリエントリ型
// ============================================================

export interface AspBadgeColor {
  bg: string;
  text: string;
  border: string;
}

export interface AspRegistryEntry {
  /** 正規化ID（小文字英語）= ProviderId として使われる */
  id: string;
  /** UI表示名（ASP_DISPLAY_NAMES用） */
  displayName: string;
  /** DB asp_name カラムに格納される値。複数可（例: DUGA + APEX） */
  dbNames: string[];
  /** 日本語名エイリアス（JA_TO_EN_MAP用。normalizeAspNameで日本語→id変換に使用） */
  jaAliases?: string[];
  /** 親ASP ID（DTIサブサービスの場合 'dti'） */
  parentId?: string;
  /** DTI URL判定パターン（DTIサブサービスのみ。URLにこの文字列を含むか判定） */
  urlPattern?: string;
  /** ASP_DISPLAY_ORDER内のソート順（null = UIフィルターに非表示） */
  displayOrder: number | null;
  /** adult-vサイトで表示するか */
  inAdultV: boolean;
  /** fanzaサイトで表示するか */
  inFanza: boolean;
  /** バッジカラー（Tailwind CSS クラス） */
  badgeColor: AspBadgeColor;
  /** PROVIDER_LABEL_MAP用の表示ラベル */
  providerLabel: string;
  /** 月額制サービスか */
  isSubscription?: boolean;
}

// ============================================================
// ASPレジストリ（単一真実源）
// ============================================================

export const ASP_REGISTRY = [
  // ---- 主要ASP ----
  {
    id: 'sokmil',
    displayName: 'SOKMIL',
    dbNames: ['SOKMIL', 'ソクミル'],
    displayOrder: 0,
    inAdultV: true,
    inFanza: false,
    badgeColor: { bg: 'bg-purple-600', text: 'text-white', border: 'border-purple-500' },
    providerLabel: 'ソクミル',
  },
  {
    id: 'duga',
    displayName: 'DUGA',
    dbNames: ['DUGA', 'APEX'],
    displayOrder: 1,
    inAdultV: true,
    inFanza: false,
    badgeColor: { bg: 'bg-orange-600', text: 'text-white', border: 'border-orange-500' },
    providerLabel: 'DUGA',
  },
  {
    id: 'fanza',
    displayName: 'FANZA',
    dbNames: ['FANZA', 'DMM'],
    displayOrder: 2,
    inAdultV: false,
    inFanza: true,
    badgeColor: { bg: 'bg-pink-600', text: 'text-white', border: 'border-pink-500' },
    providerLabel: 'FANZA',
  },
  {
    id: 'b10f',
    displayName: 'B10F',
    dbNames: ['B10F', 'b10f.jp'],
    displayOrder: 3,
    inAdultV: true,
    inFanza: false,
    badgeColor: { bg: 'bg-emerald-600', text: 'text-white', border: 'border-emerald-500' },
    providerLabel: 'b10f.jp',
  },
  {
    id: 'mgs',
    displayName: 'MGS動画',
    dbNames: ['MGS'],
    jaAliases: ['MGS動画'],
    displayOrder: 4,
    inAdultV: true,
    inFanza: false,
    badgeColor: { bg: 'bg-blue-600', text: 'text-white', border: 'border-blue-500' },
    providerLabel: 'MGS動画',
  },
  {
    id: 'fc2',
    displayName: 'FC2',
    dbNames: ['FC2'],
    displayOrder: 7,
    inAdultV: true,
    inFanza: false,
    badgeColor: { bg: 'bg-red-600', text: 'text-white', border: 'border-red-500' },
    providerLabel: 'FC2',
  },
  {
    id: 'japanska',
    displayName: 'Japanska',
    dbNames: ['Japanska', 'JAPANSKA'],
    displayOrder: 12,
    inAdultV: true,
    inFanza: false,
    badgeColor: { bg: 'bg-indigo-600', text: 'text-white', border: 'border-indigo-500' },
    providerLabel: 'Japanska',
  },
  {
    id: 'dti',
    displayName: 'DTI',
    dbNames: ['DTI'],
    displayOrder: null,
    inAdultV: false,
    inFanza: false,
    badgeColor: { bg: 'bg-gray-600', text: 'text-white', border: 'border-gray-500' },
    providerLabel: 'DTI',
  },

  // ---- DTI系サブサービス ----
  {
    id: 'caribbeancompr',
    displayName: 'カリビアンコムPR',
    dbNames: ['CARIBBEANCOMPR'],
    jaAliases: ['カリビアンコムプレミアム', 'カリビアンコムPR'],
    parentId: 'dti',
    urlPattern: 'caribbeancompr.com',
    displayOrder: 5,
    inAdultV: true,
    inFanza: false,
    badgeColor: { bg: 'bg-teal-700', text: 'text-white', border: 'border-teal-600' },
    providerLabel: 'カリビアンコムプレミアム',
  },
  {
    id: 'heyzo',
    displayName: 'HEYZO',
    dbNames: ['HEYZO'],
    parentId: 'dti',
    urlPattern: 'heyzo.com',
    displayOrder: 6,
    inAdultV: true,
    inFanza: false,
    badgeColor: { bg: 'bg-sky-600', text: 'text-white', border: 'border-sky-500' },
    providerLabel: 'HEYZO',
  },
  {
    id: '1pondo',
    displayName: '一本道',
    dbNames: ['1PONDO'],
    jaAliases: ['一本道'],
    parentId: 'dti',
    urlPattern: '1pondo.tv',
    displayOrder: 8,
    inAdultV: true,
    inFanza: false,
    badgeColor: { bg: 'bg-cyan-600', text: 'text-white', border: 'border-cyan-500' },
    providerLabel: '一本道',
  },
  {
    id: 'caribbeancom',
    displayName: 'カリビアンコム',
    dbNames: ['CARIBBEANCOM'],
    jaAliases: ['カリビアンコム'],
    parentId: 'dti',
    urlPattern: 'caribbeancom.com',
    displayOrder: 9,
    inAdultV: true,
    inFanza: false,
    badgeColor: { bg: 'bg-teal-600', text: 'text-white', border: 'border-teal-500' },
    providerLabel: 'カリビアンコム',
  },
  {
    id: 'heydouga',
    displayName: 'Hey動画',
    dbNames: ['HEYDOUGA'],
    parentId: 'dti',
    urlPattern: 'heydouga.com',
    displayOrder: 10,
    inAdultV: true,
    inFanza: false,
    badgeColor: { bg: 'bg-amber-600', text: 'text-white', border: 'border-amber-500' },
    providerLabel: 'Hey動画',
  },
  {
    id: 'x1x',
    displayName: 'X1X',
    dbNames: ['X1X'],
    parentId: 'dti',
    urlPattern: 'x1x.com',
    displayOrder: 11,
    inAdultV: true,
    inFanza: false,
    badgeColor: { bg: 'bg-gray-600', text: 'text-white', border: 'border-gray-500' },
    providerLabel: 'x1x.com',
  },
  {
    id: 'enkou55',
    displayName: 'エンコウ55',
    dbNames: ['ENKOU55'],
    parentId: 'dti',
    urlPattern: 'enkou55.com',
    displayOrder: 13,
    inAdultV: true,
    inFanza: false,
    badgeColor: { bg: 'bg-gray-600', text: 'text-white', border: 'border-gray-500' },
    providerLabel: 'エンコウ55',
  },
  {
    id: 'urekko',
    displayName: 'ウレッコ',
    dbNames: ['UREKKO'],
    parentId: 'dti',
    urlPattern: 'urekko',
    displayOrder: 14,
    inAdultV: true,
    inFanza: false,
    badgeColor: { bg: 'bg-gray-600', text: 'text-white', border: 'border-gray-500' },
    providerLabel: 'ウレッコ',
  },
  {
    id: 'tvdeav',
    displayName: 'TVDEAV',
    dbNames: ['TVDEAV'],
    parentId: 'dti',
    urlPattern: 'tvdeav',
    displayOrder: 15,
    inAdultV: true,
    inFanza: false,
    badgeColor: { bg: 'bg-gray-600', text: 'text-white', border: 'border-gray-500' },
    providerLabel: 'TVDEAV',
  },
  {
    id: 'tokyohot',
    displayName: 'Tokyo Hot',
    dbNames: ['TOKYOHOT'],
    jaAliases: ['Tokyo Hot', 'トウキョウホット'],
    parentId: 'dti',
    urlPattern: 'tokyo-hot.com',
    displayOrder: 16,
    inAdultV: true,
    inFanza: false,
    badgeColor: { bg: 'bg-red-700', text: 'text-white', border: 'border-red-600' },
    providerLabel: 'Tokyo-Hot',
  },
  {
    id: '10musume',
    displayName: '天然むすめ',
    dbNames: ['10MUSUME'],
    jaAliases: ['天然むすめ'],
    parentId: 'dti',
    urlPattern: '10musume.com',
    displayOrder: null,
    inAdultV: true,
    inFanza: false,
    badgeColor: { bg: 'bg-rose-600', text: 'text-white', border: 'border-rose-500' },
    providerLabel: '天然むすめ',
  },
  {
    id: 'pacopacomama',
    displayName: 'パコパコママ',
    dbNames: ['PACOPACOMAMA'],
    jaAliases: ['パコパコママ'],
    parentId: 'dti',
    urlPattern: 'pacopacomama.com',
    displayOrder: null,
    inAdultV: true,
    inFanza: false,
    badgeColor: { bg: 'bg-fuchsia-600', text: 'text-white', border: 'border-fuchsia-500' },
    providerLabel: 'パコパコママ',
  },
  {
    id: 'muramura',
    displayName: 'ムラムラ',
    dbNames: ['MURAMURA'],
    jaAliases: ['ムラムラ', 'ムラムラってくる素人'],
    parentId: 'dti',
    urlPattern: 'muramura.tv',
    displayOrder: null,
    inAdultV: true,
    inFanza: false,
    badgeColor: { bg: 'bg-gray-600', text: 'text-white', border: 'border-gray-500' },
    providerLabel: 'ムラムラってくる素人',
  },
  {
    id: 'av9898',
    displayName: 'AV9898',
    dbNames: ['AV9898'],
    parentId: 'dti',
    urlPattern: 'av9898.com',
    displayOrder: null,
    inAdultV: false,
    inFanza: false,
    badgeColor: { bg: 'bg-gray-600', text: 'text-white', border: 'border-gray-500' },
    providerLabel: 'AV9898',
  },
  {
    id: 'honnamatv',
    displayName: 'ホンナマTV',
    dbNames: ['HONNAMATV'],
    parentId: 'dti',
    urlPattern: 'honnamatv.com',
    displayOrder: null,
    inAdultV: false,
    inFanza: false,
    badgeColor: { bg: 'bg-gray-600', text: 'text-white', border: 'border-gray-500' },
    providerLabel: 'honnamatv',
  },
] as const satisfies readonly AspRegistryEntry[];

// ============================================================
// 派生型
// ============================================================

/** ProviderId — レジストリから自動導出 */
export type ProviderId = (typeof ASP_REGISTRY)[number]['id'];

// 派生定数の計算用に AspRegistryEntry[] としてキャスト
// （as const satisfies の narrow 型だとオプショナルプロパティにアクセスできないため）
const _entries: readonly AspRegistryEntry[] = ASP_REGISTRY;

// ============================================================
// 派生定数（全てASP_REGISTRYから自動生成）
// ============================================================

/** DTI系サブサービスのURLパターン → 正規化ID */
export const DTI_URL_PATTERNS: Record<string, string> = Object.fromEntries(
  _entries.filter(e => e.urlPattern).map(e => [e.urlPattern!, e.id])
);

/** 日本語ASP名 → 正規化ID */
export const JA_TO_EN_MAP: Record<string, string> = Object.fromEntries(
  _entries.flatMap(e => (e.jaAliases ?? []).map(ja => [ja, e.id]))
);

/** DB名（大文字等） → 正規化ID */
export const UPPER_TO_LOWER_MAP: Record<string, string> = Object.fromEntries(
  _entries.flatMap(e => e.dbNames.map(db => [db, e.id]))
);

/** 正規化ID → 表示名 */
export const ASP_DISPLAY_NAMES: Record<string, string> = Object.fromEntries(
  _entries.map(e => [e.id, e.displayName])
);

/** 有効なASP名セット */
export const VALID_ASP_NAMES = new Set<string>(_entries.map(e => e.id));

/** UI表示順序（displayOrderがnullでないもの） */
export const ASP_DISPLAY_ORDER: string[] = _entries
  .filter(e => e.displayOrder !== null)
  .sort((a, b) => a.displayOrder! - b.displayOrder!)
  .map(e => e.id);

/** ASPバッジカラー */
export const ASP_BADGE_COLORS: Record<string, AspBadgeColor> = {
  ...Object.fromEntries(_entries.map(e => [e.id, e.badgeColor])),
  default: { bg: 'bg-gray-600', text: 'text-white', border: 'border-gray-500' },
};

/** DB名 → 表示ラベル（PROVIDER_LABEL_MAP互換） */
export const PROVIDER_LABEL_MAP: Record<string, string> = Object.fromEntries(
  _entries.flatMap(e => e.dbNames.map(db => [db, e.providerLabel]))
);

/** 正規化ID → DB名配列（PROVIDER_TO_ASP_MAPPING互換） */
export const PROVIDER_TO_ASP_MAPPING: Record<string, string[]> = Object.fromEntries(
  _entries.map(e => [e.id, [...e.dbNames]])
);

/** ASP名（正規化/DB名/日本語）→ ProviderId の双方向マッピング */
export const ASP_TO_PROVIDER_ID: Record<string, ProviderId | undefined> = Object.fromEntries([
  // id → id
  ..._entries.map(e => [e.id, e.id as ProviderId]),
  // dbNames → id
  ..._entries.flatMap(e => e.dbNames.map(db => [db, e.id as ProviderId])),
  // jaAliases → id
  ..._entries.flatMap(e => (e.jaAliases ?? []).map(ja => [ja, e.id as ProviderId])),
  // レガシー追加エイリアス
  ['DMM', 'fanza' as ProviderId],
  ['人妻斬り', 'muramura' as ProviderId],
  ['金髪天國', 'tokyohot' as ProviderId],
]);

/** adult-vサイトで表示するASP一覧（DB名混在：既存互換） */
export const ADULT_V_ASPS: string[] = _entries
  .filter(e => e.inAdultV)
  .map(e => {
    // 既存のsite-mode.tsとの互換性: 主要ASPはDB名、DTIサブサービスは正規化ID
    if (!e.parentId) return e.dbNames[0]!;
    return e.id;
  });

/** fanzaサイトで表示するASP一覧 */
export const FANZA_ASPS: string[] = _entries
  .filter(e => e.inFanza)
  .map(e => e.dbNames[0]!);

/** VALID_PROVIDER_IDS（主要ASP IDのみ、DTIサブサービス含まず） */
export const VALID_PROVIDER_IDS: readonly ProviderId[] = _entries
  .filter(e => !e.parentId)
  .map(e => e.id as ProviderId);

/** DTIサブサービスIDの一覧 */
export const DTI_SUB_SERVICE_IDS: readonly string[] = _entries
  .filter(e => e.parentId === 'dti')
  .map(e => e.id);

/** レガシープロバイダーマッピング（mapLegacyProvider用） */
export const LEGACY_PROVIDER_MAP: Record<string, ProviderId> = Object.fromEntries([
  // 正規化ID → そのまま
  ..._entries.filter(e => !e.parentId).map(e => [e.id, e.id as ProviderId]),
  // dbNames → id（小文字化して）
  ..._entries.filter(e => !e.parentId).flatMap(e =>
    e.dbNames.map(db => [db.toLowerCase(), e.id as ProviderId])
  ),
  // DTIサブサービス → 'dti'
  ..._entries.filter(e => e.parentId === 'dti').flatMap(e => [
    [e.id, 'dti' as ProviderId],
    ...(e.jaAliases ?? []).map(ja => [ja, 'dti' as ProviderId]),
  ]),
  // レガシーエイリアス
  ['apex', 'duga' as ProviderId],
  ['dmm', 'fanza' as ProviderId],
]);

/** ASP統計表示名マッピング（stats-asp.ts用） */
export const ASP_STATS_NAME_MAP: Record<string, string> = Object.fromEntries(
  _entries
    .filter(e => e.id !== 'dti' && e.id !== 'fanza')
    .map(e => {
      // DB名の最初の値 → 表示ラベル（stats-asp互換）
      const dbName = e.dbNames[0]!;
      // 主要ASP: db名そのまま、DTIサブサービス: 正規化idをキーに
      const key = e.parentId ? e.id : (dbName === 'B10F' ? 'b10f.jp' : dbName);
      return [key, e.providerLabel];
    })
);

// ============================================================
// ヘルパー関数
// ============================================================

/** レジストリからIDでエントリを検索 */
export function getAspEntry(id: string): AspRegistryEntry | undefined {
  return _entries.find(e => e.id === id);
}

/** レジストリからDB名でエントリを検索 */
export function getAspEntryByDbName(dbName: string): AspRegistryEntry | undefined {
  return _entries.find(e => e.dbNames.includes(dbName));
}
