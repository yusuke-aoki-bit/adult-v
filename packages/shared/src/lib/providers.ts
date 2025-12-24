import type { ProviderId, ProviderMeta } from '../types/product';

// 型の再エクスポート
export type { ProviderId, ProviderMeta };

/**
 * プロバイダーメタデータ（クライアントサイドでも使用可能）
 * ASP_DISPLAY_ORDER順に色相環で区別しやすい配色
 * 1. SOKMIL - 紫 (violet)
 * 2. DUGA - 緑 (emerald)
 * 3. FANZA - ピンク〜赤 (pink-red)
 * 4. b10f.jp - オレンジ (orange)
 * 5. MGS動画 - 空色 (sky)
 * 6. カリビアンコムPR - 赤〜ローズ (red-rose)
 * 7. HEYZO - 黄色 (yellow)
 * 8. FC2 - インディゴ (indigo)
 * 9. 一本道 - 青 (blue)
 * 10. CARIBBEANCOM - 赤〜オレンジ (red-orange)
 * 11. HEYDOUGA - シアン (cyan)
 * 12. X1X - フクシア (fuchsia)
 * 13. Japanska - ローズ (rose)
 * 14. ENKOU55 - ライム (lime)
 * 15. UREKKO - アンバー (amber)
 * 16. TOKYOHOT - スレート (slate)
 */
export const providerMeta: Record<ProviderId, ProviderMeta> = {
  // ===== 主要ASP =====
  sokmil: {
    id: 'sokmil',
    label: 'SOKMIL',
    accentClass: 'from-violet-600 to-purple-500',
    textClass: 'text-violet-300',
    gradientColors: { from: '#7c3aed', to: '#a855f7' },
    description: '熟女・マニアック系が充実。独占レンタルも多い',
    siteUrl: 'https://www.sokmil.com/',
  },
  duga: {
    id: 'duga',
    label: 'DUGA',
    accentClass: 'from-emerald-600 to-green-500',
    textClass: 'text-emerald-300',
    gradientColors: { from: '#059669', to: '#22c55e' },
    description: '専属女優に強い高画質レーベル。女優別特集が豊富',
    siteUrl: 'https://duga.jp/',
  },
  fanza: {
    id: 'fanza',
    label: 'FANZA',
    accentClass: 'from-pink-600 to-red-500',
    textClass: 'text-pink-300',
    gradientColors: { from: '#db2777', to: '#ef4444' },
    description: '国内最大級のアダルト動画配信サイト',
    siteUrl: 'https://www.dmm.co.jp/digital/videoa/',
  },
  b10f: {
    id: 'b10f',
    label: 'b10f.jp',
    accentClass: 'from-orange-600 to-amber-500',
    textClass: 'text-orange-300',
    gradientColors: { from: '#ea580c', to: '#f59e0b' },
    description: 'VR・高画質作品が豊富なプラットフォーム',
    siteUrl: 'https://b10f.jp/',
  },
  mgs: {
    id: 'mgs',
    label: 'MGS動画',
    accentClass: 'from-sky-600 to-blue-500',
    textClass: 'text-sky-300',
    gradientColors: { from: '#0284c7', to: '#3b82f6' },
    description: 'シロウトTV等の素人系に強いプラットフォーム',
    siteUrl: 'https://www.mgstage.com/',
  },
  // ===== DTI個別サービス =====
  caribbeancompr: {
    id: 'caribbeancompr',
    label: 'カリビアンコムPR',
    accentClass: 'from-red-600 to-rose-500',
    textClass: 'text-red-300',
    gradientColors: { from: '#dc2626', to: '#f43f5e' },
    description: 'カリビアンコムプレミアム',
    siteUrl: 'https://www.caribbeancompr.com/',
  },
  heyzo: {
    id: 'heyzo',
    label: 'HEYZO',
    accentClass: 'from-yellow-500 to-orange-400',
    textClass: 'text-yellow-300',
    gradientColors: { from: '#eab308', to: '#fb923c' },
    description: 'オリジナル無修正動画',
    siteUrl: 'https://www.heyzo.com/',
  },
  fc2: {
    id: 'fc2',
    label: 'FC2',
    accentClass: 'from-indigo-600 to-blue-500',
    textClass: 'text-indigo-300',
    gradientColors: { from: '#4f46e5', to: '#3b82f6' },
    description: '素人投稿動画プラットフォーム',
    siteUrl: 'https://adult.contents.fc2.com/',
  },
  '1pondo': {
    id: '1pondo',
    label: '一本道',
    accentClass: 'from-blue-700 to-indigo-500',
    textClass: 'text-blue-300',
    gradientColors: { from: '#1d4ed8', to: '#6366f1' },
    description: '厳選された無修正動画',
    siteUrl: 'https://www.1pondo.tv/',
  },
  caribbeancom: {
    id: 'caribbeancom',
    label: 'カリビアンコム',
    accentClass: 'from-red-700 to-orange-500',
    textClass: 'text-red-300',
    gradientColors: { from: '#b91c1c', to: '#f97316' },
    description: '日本最大級の無修正動画サイト',
    siteUrl: 'https://www.caribbeancom.com/',
  },
  heydouga: {
    id: 'heydouga',
    label: 'HEYDOUGA',
    accentClass: 'from-cyan-600 to-teal-500',
    textClass: 'text-cyan-300',
    gradientColors: { from: '#0891b2', to: '#14b8a6' },
    description: 'オリジナル無修正動画配信',
    siteUrl: 'https://www.heydouga.com/',
  },
  x1x: {
    id: 'x1x',
    label: 'X1X',
    accentClass: 'from-fuchsia-600 to-purple-500',
    textClass: 'text-fuchsia-300',
    gradientColors: { from: '#c026d3', to: '#a855f7' },
    description: '無修正動画配信サイト',
    siteUrl: 'https://x1x.com/',
  },
  japanska: {
    id: 'japanska',
    label: 'Japanska',
    accentClass: 'from-rose-600 to-pink-500',
    textClass: 'text-rose-300',
    gradientColors: { from: '#e11d48', to: '#ec4899' },
    description: '海外向け日本作品配信サイト',
    siteUrl: 'https://www.japanska-xxx.com/',
  },
  enkou55: {
    id: 'enkou55',
    label: 'ENKOU55',
    accentClass: 'from-lime-600 to-green-500',
    textClass: 'text-lime-300',
    gradientColors: { from: '#65a30d', to: '#22c55e' },
    description: '素人系動画配信',
    siteUrl: 'https://enkou55.com/',
  },
  urekko: {
    id: 'urekko',
    label: 'UREKKO',
    accentClass: 'from-amber-600 to-yellow-500',
    textClass: 'text-amber-300',
    gradientColors: { from: '#d97706', to: '#eab308' },
    description: '人気動画配信サイト',
    siteUrl: 'https://urekko.com/',
  },
  tokyohot: {
    id: 'tokyohot',
    label: 'TOKYOHOT',
    accentClass: 'from-slate-600 to-gray-500',
    textClass: 'text-slate-300',
    gradientColors: { from: '#475569', to: '#6b7280' },
    description: '過激な無修正動画',
    siteUrl: 'https://www.tokyo-hot.com/',
  },
  tvdeav: {
    id: 'tvdeav',
    label: 'TVDEAV',
    accentClass: 'from-teal-600 to-emerald-500',
    textClass: 'text-teal-300',
    gradientColors: { from: '#0d9488', to: '#10b981' },
    description: 'TV出演AV女優の動画配信',
    siteUrl: 'https://tvdeav.com/',
  },
  // ===== その他DTI系 =====
  dti: {
    id: 'dti',
    label: 'DTI',
    accentClass: 'from-rose-700 to-red-500',
    textClass: 'text-rose-300',
    gradientColors: { from: '#be123c', to: '#ef4444' },
    description: '一本道・カリビアンコム等の無修正サイト',
    siteUrl: 'https://www.dti.ne.jp/',
  },
  '10musume': {
    id: '10musume',
    label: '天然むすめ',
    accentClass: 'from-pink-500 to-fuchsia-400',
    textClass: 'text-pink-300',
    gradientColors: { from: '#ec4899', to: '#e879f9' },
    description: '素人系無修正動画',
    siteUrl: 'https://www.10musume.com/',
  },
  pacopacomama: {
    id: 'pacopacomama',
    label: 'パコパコママ',
    accentClass: 'from-rose-500 to-pink-400',
    textClass: 'text-rose-300',
    gradientColors: { from: '#f43f5e', to: '#f472b6' },
    description: '熟女系無修正動画',
    siteUrl: 'https://www.pacopacomama.com/',
  },
  muramura: {
    id: 'muramura',
    label: 'ムラムラ',
    accentClass: 'from-purple-600 to-violet-500',
    textClass: 'text-purple-300',
    gradientColors: { from: '#9333ea', to: '#8b5cf6' },
    description: '素人系無修正動画',
    siteUrl: 'https://muramura.tv/',
  },
};

/**
 * サブスクリプション型（月額制）プロバイダーかどうか判定
 * DTI系サービスとJapanskaが該当
 */
export function isSubscriptionProvider(aspName: string): boolean {
  const name = aspName.toLowerCase();
  // DTI系サービス（サブスクリプション型）
  const dtiServices = [
    'dti',
    'caribbeancom',
    'caribbeancompr',
    '1pondo',
    'heyzo',
    '10musume',
    'pacopacomama',
    'muramura',
    'tokyohot',
  ];
  return dtiServices.includes(name) || name === 'japanska';
}

/**
 * プロバイダーIDを正規化
 */
export function normalizeProviderId(aspName: string): ProviderId | null {
  const name = aspName.toLowerCase();
  if (name in providerMeta) {
    return name as ProviderId;
  }
  return null;
}
