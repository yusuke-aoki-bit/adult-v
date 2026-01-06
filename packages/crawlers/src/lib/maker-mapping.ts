/**
 * メーカー/レーベル マッピング
 *
 * AVメーカーの品番プレフィックスから統一メーカー名を取得するための共通モジュール
 * MGS、FANZA、その他ASP間で統一されたメーカー情報を提供
 */

/**
 * メーカー情報
 */
export interface MakerInfo {
  /** 統一メーカー名（日本語） */
  name: string;
  /** メーカー名（英語） */
  nameEn?: string;
  /** メーカーカテゴリ */
  category?: 'major' | 'indie' | 'amateur' | 'exclusive';
  /** MGS用のメーカーパス（例: sodcreate/107stars） */
  mgsPath?: string;
  /** FANZA用のメーカーID */
  fanzaMakerId?: string;
}

/**
 * 品番プレフィックス → メーカー情報マッピング
 *
 * キーは大文字で統一
 */
export const MAKER_MAP: Record<string, MakerInfo> = {
  // === S1 NO.1 STYLE ===
  SSIS: { name: 'S1 NO.1 STYLE', nameEn: 'S1 NO.1 STYLE', category: 'major' },
  SSNI: { name: 'S1 NO.1 STYLE', nameEn: 'S1 NO.1 STYLE', category: 'major' },
  SONE: { name: 'S1 NO.1 STYLE', nameEn: 'S1 NO.1 STYLE', category: 'major' },

  // === MOODYZ ===
  MIDV: { name: 'ムーディーズ', nameEn: 'MOODYZ', category: 'major' },
  MIFD: { name: 'ムーディーズ', nameEn: 'MOODYZ', category: 'major' },
  MIDE: { name: 'ムーディーズ', nameEn: 'MOODYZ', category: 'major' },
  MIAA: { name: 'ムーディーズ', nameEn: 'MOODYZ', category: 'major' },

  // === Idea Pocket ===
  IPX: { name: 'アイデアポケット', nameEn: 'Idea Pocket', category: 'major' },
  IPZZ: { name: 'アイデアポケット', nameEn: 'Idea Pocket', category: 'major' },
  IPZ: { name: 'アイデアポケット', nameEn: 'Idea Pocket', category: 'major' },

  // === PREMIUM ===
  PRED: { name: 'プレミアム', nameEn: 'PREMIUM', category: 'major' },
  PGD: { name: 'プレミアム', nameEn: 'PREMIUM', category: 'major' },

  // === kawaii* ===
  CAWD: { name: 'kawaii*', nameEn: 'kawaii', category: 'major', mgsPath: 'kawaii/112cawd' },
  KAVR: { name: 'kawaii*', nameEn: 'kawaii', category: 'major' },

  // === SODクリエイト ===
  STARS: { name: 'SODクリエイト', nameEn: 'SOD Create', category: 'major', mgsPath: 'sodcreate/107stars' },
  STAR: { name: 'SODクリエイト', nameEn: 'SOD Create', category: 'major' },
  SDAB: { name: 'SODクリエイト', nameEn: 'SOD Create', category: 'major', mgsPath: 'sodcreate/1sdab' },
  SDJS: { name: 'SODクリエイト', nameEn: 'SOD Create', category: 'major', mgsPath: 'sodcreate/1sdjs' },
  SDDE: { name: 'SODクリエイト', nameEn: 'SOD Create', category: 'major', mgsPath: 'sodcreate/1sdde' },
  SDAM: { name: 'SODクリエイト', nameEn: 'SOD Create', category: 'major', mgsPath: 'sodcreate/1sdam' },
  SDMU: { name: 'SODクリエイト', nameEn: 'SOD Create', category: 'major', mgsPath: 'sodcreate/1sdmu' },
  SDNT: { name: 'SODクリエイト', nameEn: 'SOD Create', category: 'major', mgsPath: 'sodcreate/1sdnt' },
  SDNM: { name: 'SODクリエイト', nameEn: 'SOD Create', category: 'major', mgsPath: 'sodcreate/1sdnm' },

  // === プレステージ ===
  ABW: { name: 'プレステージ', nameEn: 'Prestige', category: 'major', mgsPath: 'prestige/118abw' },
  ABP: { name: 'プレステージ', nameEn: 'Prestige', category: 'major', mgsPath: 'prestige/118abp' },
  ABS: { name: 'プレステージ', nameEn: 'Prestige', category: 'major', mgsPath: 'prestige/118abs' },
  ABF: { name: 'プレステージ', nameEn: 'Prestige', category: 'major', mgsPath: 'prestige/118abf' },
  CHN: { name: 'プレステージ', nameEn: 'Prestige', category: 'major', mgsPath: 'prestige/118chn' },
  TEM: { name: 'プレステージ', nameEn: 'Prestige', category: 'major', mgsPath: 'prestige/118tem' },
  SGA: { name: 'プレステージ', nameEn: 'Prestige', category: 'major', mgsPath: 'prestige/118sga' },
  SABA: { name: 'プレステージ', nameEn: 'Prestige', category: 'major', mgsPath: 'prestige/118saba' },
  DIC: { name: 'プレステージ', nameEn: 'Prestige', category: 'major' },
  ESK: { name: 'プレステージ', nameEn: 'Prestige', category: 'major' },
  MGT: { name: 'プレステージ', nameEn: 'Prestige', category: 'major' },

  // === FALENO ===
  FSDSS: { name: 'FALENO', nameEn: 'FALENO', category: 'major' },
  FLNS: { name: 'FALENO', nameEn: 'FALENO', category: 'major' },
  FOCS: { name: 'FALENO', nameEn: 'FALENO', category: 'major' },
  MFCS: { name: 'FALENO', nameEn: 'FALENO', category: 'major', mgsPath: 'faleno/h_1530mfcs' },

  // === アタッカーズ ===
  SSPD: { name: 'アタッカーズ', nameEn: 'Attackers', category: 'major' },
  ATID: { name: 'アタッカーズ', nameEn: 'Attackers', category: 'major' },
  SHKD: { name: 'アタッカーズ', nameEn: 'Attackers', category: 'major' },
  RBD: { name: 'アタッカーズ', nameEn: 'Attackers', category: 'major' },
  RBK: { name: 'アタッカーズ', nameEn: 'Attackers', category: 'major' },
  ADN: { name: 'アタッカーズ', nameEn: 'Attackers', category: 'major' },

  // === MADONNA ===
  JUQ: { name: 'マドンナ', nameEn: 'MADONNA', category: 'major' },
  JUL: { name: 'マドンナ', nameEn: 'MADONNA', category: 'major' },
  JUY: { name: 'マドンナ', nameEn: 'MADONNA', category: 'major' },
  JUC: { name: 'マドンナ', nameEn: 'MADONNA', category: 'major' },
  ROE: { name: 'マドンナ', nameEn: 'MADONNA', category: 'major' },
  VENX: { name: 'マドンナ', nameEn: 'MADONNA', category: 'major' },

  // === kira☆kira ===
  BLK: { name: 'kira☆kira', nameEn: 'kira kira', category: 'major' },

  // === E-BODY ===
  EBWH: { name: 'E-BODY', nameEn: 'E-BODY', category: 'major' },
  EBOD: { name: 'E-BODY', nameEn: 'E-BODY', category: 'major' },
  EYAN: { name: 'E-BODY', nameEn: 'E-BODY', category: 'major' },

  // === ワンズファクトリー ===
  ONEZ: { name: 'ワンズファクトリー', nameEn: 'ONES Factory', category: 'major' },

  // === ナチュラルハイ ===
  NHDTB: { name: 'ナチュラルハイ', nameEn: 'Natural High', category: 'major' },
  NHDTA: { name: 'ナチュラルハイ', nameEn: 'Natural High', category: 'major' },

  // === ケイ・エム・プロデュース ===
  REAL: { name: 'K.M.Produce', nameEn: 'K.M.Produce', category: 'major' },

  // === 本中 ===
  HMN: { name: '本中', nameEn: 'Honnaka', category: 'major' },
  HND: { name: '本中', nameEn: 'Honnaka', category: 'major' },

  // === 痴女天堂 ===
  CJOD: { name: '痴女天堂', nameEn: 'Chijo Heaven', category: 'major' },

  // === ナンパTV / シロウトTV (素人系) ===
  '200GANA': { name: 'ナンパTV', nameEn: 'Nampa TV', category: 'amateur' },
  '261ARA': { name: 'シロウトTV', nameEn: 'Shirouto TV', category: 'amateur', mgsPath: 'shiroutotv/261ara' },
  '261SIRO': { name: 'シロウトTV', nameEn: 'Shirouto TV', category: 'amateur', mgsPath: 'shiroutotv/261siro' },
  '259LUXU': { name: 'ラグジュTV', nameEn: 'LUXU TV', category: 'amateur', mgsPath: 'shiroutotv/259luxu' },
  '300MIUM': { name: 'シロウトTV', nameEn: 'Shirouto TV', category: 'amateur', mgsPath: 'shiroutotv/300mium' },
  '300MAAN': { name: 'シロウトTV', nameEn: 'Shirouto TV', category: 'amateur', mgsPath: 'shiroutotv/300maan' },
  '300NTK': { name: 'シロウトTV', nameEn: 'Shirouto TV', category: 'amateur', mgsPath: 'shiroutotv/300ntk' },
  '300ORETD': { name: 'シロウトTV', nameEn: 'Shirouto TV', category: 'amateur', mgsPath: 'shiroutotv/300oretd' },
  '390JAC': { name: 'シロウトTV', nameEn: 'Shirouto TV', category: 'amateur' },

  // === FC2 ===
  FC2: { name: 'FC2', nameEn: 'FC2', category: 'indie' },
  'FC2-PPV': { name: 'FC2', nameEn: 'FC2', category: 'indie' },

  // === Caribbeancom (カリビアンコム) ===
  CARIB: { name: 'カリビアンコム', nameEn: 'Caribbeancom', category: 'exclusive' },

  // === 1Pondo (一本道) ===
  '1PON': { name: '一本道', nameEn: '1Pondo', category: 'exclusive' },

  // === HEYZO ===
  HEYZO: { name: 'HEYZO', nameEn: 'HEYZO', category: 'exclusive' },

  // === Tokyo Hot ===
  TOKYO: { name: 'Tokyo-Hot', nameEn: 'Tokyo-Hot', category: 'exclusive' },

  // === MAXING ===
  MXGS: { name: 'MAXING', nameEn: 'MAXING', category: 'major' },

  // === Fitch ===
  JUFD: { name: 'Fitch', nameEn: 'Fitch', category: 'major' },
  JUFE: { name: 'Fitch', nameEn: 'Fitch', category: 'major' },

  // === 溜池ゴロー ===
  MEYD: { name: '溜池ゴロー', nameEn: 'Tameike Goro', category: 'major' },

  // === Das! ===
  DASD: { name: 'Das!', nameEn: 'Das!', category: 'major' },

  // === Wanz Factory ===
  WAAA: { name: 'WANZ FACTORY', nameEn: 'WANZ FACTORY', category: 'major' },
  WANZ: { name: 'WANZ FACTORY', nameEn: 'WANZ FACTORY', category: 'major' },

  // === S-Cute ===
  SQTE: { name: 'S-Cute', nameEn: 'S-Cute', category: 'major' },

  // === Aroma企画 ===
  ARM: { name: 'Aroma企画', nameEn: 'AROMA', category: 'major' },

  // === 妄想族 ===
  SERO: { name: '妄想族', nameEn: 'Mousouzoku', category: 'major' },

  // === V&R ===
  VRTM: { name: 'V&R PRODUCE', nameEn: 'V&R PRODUCE', category: 'major' },

  // === DANDY ===
  DANDY: { name: 'DANDY', nameEn: 'DANDY', category: 'major' },

  // === Hunter ===
  HUNTA: { name: 'Hunter', nameEn: 'Hunter', category: 'major' },
  HUNTB: { name: 'Hunter', nameEn: 'Hunter', category: 'major' },
  HUNTC: { name: 'Hunter', nameEn: 'Hunter', category: 'major' },

  // === ムゲンエンタテインメント ===
  MGMQ: { name: 'ムゲンエンタテインメント', nameEn: 'Mugen Entertainment', category: 'major' },

  // === Bi ===
  BDSR: { name: 'Bi', nameEn: 'Bi', category: 'major' },

  // === Venus ===
  VEC: { name: 'Venus', nameEn: 'Venus', category: 'major' },
  VENU: { name: 'Venus', nameEn: 'Venus', category: 'major' },

  // === Oppai ===
  PPPD: { name: 'OPPAI', nameEn: 'OPPAI', category: 'major' },

  // === LEO ===
  UMD: { name: 'LEO', nameEn: 'LEO', category: 'major' },

  // === TMA ===
  HITMA: { name: 'TMA', nameEn: 'TMA', category: 'major' },

  // === Glory Quest ===
  GVH: { name: 'Glory Quest', nameEn: 'Glory Quest', category: 'major' },
  GVG: { name: 'Glory Quest', nameEn: 'Glory Quest', category: 'major' },
};

/**
 * 品番プレフィックスからメーカー情報を取得
 *
 * @param prefix 品番プレフィックス（例: SSIS, 300MIUM）
 * @returns メーカー情報、見つからない場合はnull
 */
export function getMakerByPrefix(prefix: string): MakerInfo | null {
  if (!prefix) return null;
  const normalized = prefix.toUpperCase().trim();
  return MAKER_MAP[normalized] || null;
}

/**
 * 品番からメーカー情報を取得
 *
 * @param productCode 品番（例: SSIS-865, 300MIUM-1359）
 * @returns メーカー情報、見つからない場合はnull
 */
export function getMakerByProductCode(productCode: string): MakerInfo | null {
  if (!productCode) return null;

  const normalized = productCode.toUpperCase().trim();

  // h_XXXXプレフィックス除去
  const withoutPrefix = normalized.replace(/^H_\d+/, '');

  // パターン1: ハイフン区切り（SSIS-865, 300MIUM-1359）
  let match = withoutPrefix.match(/^(\d*[A-Z]+)-\d+$/);
  if (match && match[1]) {
    return getMakerByPrefix(match[1]);
  }

  // パターン2: 数字プレフィックス付き（300MIUM1359）
  match = withoutPrefix.match(/^(\d+[A-Z]+)\d+$/);
  if (match && match[1]) {
    return getMakerByPrefix(match[1]);
  }

  // パターン3: 英字のみ（SSIS865）
  match = withoutPrefix.match(/^([A-Z]+)\d+$/);
  if (match && match[1]) {
    return getMakerByPrefix(match[1]);
  }

  return null;
}

/**
 * メーカー名からメーカー情報を逆引き
 *
 * @param makerName メーカー名（日本語または英語）
 * @returns メーカー情報とプレフィックスのリスト
 */
export function getPrefixesByMakerName(makerName: string): { prefix: string; info: MakerInfo }[] {
  if (!makerName) return [];

  const results: { prefix: string; info: MakerInfo }[] = [];
  const searchName = makerName.toLowerCase();

  for (const [prefix, info] of Object.entries(MAKER_MAP)) {
    if (
      info['name'].toLowerCase().includes(searchName) ||
      (info['nameEn'] && info['nameEn'].toLowerCase().includes(searchName))
    ) {
      results.push({ prefix, info });
    }
  }

  return results;
}

/**
 * MGS用のメーカーパスを取得
 *
 * @param prefix 品番プレフィックス
 * @returns MGSメーカーパス（例: sodcreate/107stars）、見つからない場合はnull
 */
export function getMgsPath(prefix: string): string | null {
  const maker = getMakerByPrefix(prefix);
  return maker?.mgsPath || null;
}

/**
 * 全メーカー名のリストを取得（重複なし）
 */
export function getAllMakerNames(): string[] {
  const names = new Set<string>();
  for (const info of Object.values(MAKER_MAP)) {
    names.add(info['name']);
  }
  return Array.from(names).sort();
}

/**
 * カテゴリ別のメーカー情報を取得
 */
export function getMakersByCategory(category: MakerInfo['category']): { prefix: string; info: MakerInfo }[] {
  const results: { prefix: string; info: MakerInfo }[] = [];

  for (const [prefix, info] of Object.entries(MAKER_MAP)) {
    if (info.category === category) {
      results.push({ prefix, info });
    }
  }

  return results;
}
