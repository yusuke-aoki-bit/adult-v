/**
 * ASP名から表示用ラベルへのマッピング
 * 両サイト（adult-v, fanza）で共通使用
 */

/**
 * ASP名を表示用ラベルにマッピング
 */
export const PROVIDER_LABEL_MAP: Record<string, string> = {
  // 主要ASP
  'APEX': 'DUGA',
  'DUGA': 'DUGA',
  'DTI': 'DTI',
  'DMM': 'DMM',
  'FANZA': 'FANZA',
  'MGS': 'MGS動画',
  'SOKMIL': 'ソクミル',
  'ソクミル': 'ソクミル',
  'B10F': 'b10f.jp',
  'JAPANSKA': 'Japanska',
  'FC2': 'FC2',
  'TOKYOHOT': 'Tokyo-Hot',
  // DTI系サイト
  'HEYZO': 'HEYZO',
  'カリビアンコムプレミアム': 'カリビアンコムプレミアム',
  'CARIBBEANCOMPR': 'カリビアンコムプレミアム',
  'CARIBBEANCOM': 'カリビアンコム',
  '1PONDO': '一本道',
  '10MUSUME': '天然むすめ',
  'PACOPACOMAMA': 'パコパコママ',
  'MURAMURA': 'ムラムラってくる素人',
  'HEYDOUGA': 'Hey動画',
  'AV9898': 'AV9898',
  'HONNAMATV': 'honnamatv',
  'X1X': 'x1x.com',
};

/**
 * ASP名から表示用ラベルを取得
 * @param aspName - ASP名
 * @returns 表示用ラベル（見つからない場合は元のASP名を返す）
 */
export function getProviderLabel(aspName: string): string {
  const upperName = aspName.toUpperCase();
  return PROVIDER_LABEL_MAP[upperName] || PROVIDER_LABEL_MAP[aspName] || aspName;
}
