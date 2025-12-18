import type { ProviderId, ProviderMeta } from '../types/product';

// 型の再エクスポート
export type { ProviderId, ProviderMeta };

/**
 * プロバイダーメタデータ（クライアントサイドでも使用可能）
 */
export const providerMeta: Record<ProviderId, ProviderMeta> = {
  duga: {
    id: 'duga',
    label: 'DUGA',
    accentClass: 'from-emerald-500 to-teal-500',
    textClass: 'text-emerald-300',
    description: '専属女優に強い高画質レーベル。女優別特集が豊富',
    siteUrl: 'https://duga.jp/',
  },
  sokmil: {
    id: 'sokmil',
    label: 'SOKMIL',
    accentClass: 'from-purple-600 to-blue-600',
    textClass: 'text-purple-300',
    description: '熟女・マニアック系が充実。独占レンタルも多い',
    siteUrl: 'https://www.sokmil.com/',
  },
  dti: {
    id: 'dti',
    label: 'DTI',
    accentClass: 'from-red-600 to-rose-500',
    textClass: 'text-rose-300',
    description: '一本道・カリビアンコム等の無修正サイト',
    siteUrl: 'https://www.dti.ne.jp/',
  },
  mgs: {
    id: 'mgs',
    label: 'MGS動画',
    accentClass: 'from-blue-500 to-cyan-500',
    textClass: 'text-blue-300',
    description: 'シロウトTV等の素人系に強いプラットフォーム',
    siteUrl: 'https://www.mgstage.com/',
  },
  b10f: {
    id: 'b10f',
    label: 'b10f.jp',
    accentClass: 'from-orange-500 to-amber-500',
    textClass: 'text-orange-300',
    description: 'VR・高画質作品が豊富なプラットフォーム',
    siteUrl: 'https://b10f.jp/',
  },
  japanska: {
    id: 'japanska',
    label: 'Japanska',
    accentClass: 'from-pink-500 to-rose-500',
    textClass: 'text-pink-300',
    description: '海外向け日本作品配信サイト',
    siteUrl: 'https://www.japanska-xxx.com/',
  },
  fanza: {
    id: 'fanza',
    label: 'FANZA',
    accentClass: 'from-pink-600 to-red-500',
    textClass: 'text-pink-300',
    description: '国内最大級のアダルト動画配信サイト',
    siteUrl: 'https://www.dmm.co.jp/digital/videoa/',
  },
  fc2: {
    id: 'fc2',
    label: 'FC2',
    accentClass: 'from-indigo-500 to-violet-500',
    textClass: 'text-indigo-300',
    description: '素人投稿動画プラットフォーム',
    siteUrl: 'https://adult.contents.fc2.com/',
  },
  // DTI個別サービス
  caribbeancom: {
    id: 'caribbeancom',
    label: 'カリビアンコム',
    accentClass: 'from-red-600 to-orange-500',
    textClass: 'text-red-300',
    description: '日本最大級の無修正動画サイト',
    siteUrl: 'https://www.caribbeancom.com/',
  },
  caribbeancompr: {
    id: 'caribbeancompr',
    label: 'カリビアンコムPR',
    accentClass: 'from-red-700 to-rose-500',
    textClass: 'text-red-300',
    description: 'カリビアンコムプレミアム',
    siteUrl: 'https://www.caribbeancompr.com/',
  },
  '1pondo': {
    id: '1pondo',
    label: '一本道',
    accentClass: 'from-blue-600 to-indigo-500',
    textClass: 'text-blue-300',
    description: '厳選された無修正動画',
    siteUrl: 'https://www.1pondo.tv/',
  },
  heyzo: {
    id: 'heyzo',
    label: 'HEYZO',
    accentClass: 'from-yellow-500 to-amber-500',
    textClass: 'text-yellow-300',
    description: 'オリジナル無修正動画',
    siteUrl: 'https://www.heyzo.com/',
  },
  '10musume': {
    id: '10musume',
    label: '天然むすめ',
    accentClass: 'from-pink-500 to-fuchsia-500',
    textClass: 'text-pink-300',
    description: '素人系無修正動画',
    siteUrl: 'https://www.10musume.com/',
  },
  pacopacomama: {
    id: 'pacopacomama',
    label: 'パコパコママ',
    accentClass: 'from-rose-500 to-pink-500',
    textClass: 'text-rose-300',
    description: '熟女系無修正動画',
    siteUrl: 'https://www.pacopacomama.com/',
  },
  muramura: {
    id: 'muramura',
    label: 'ムラムラ',
    accentClass: 'from-purple-500 to-violet-500',
    textClass: 'text-purple-300',
    description: '素人系無修正動画',
    siteUrl: 'https://muramura.tv/',
  },
  tokyohot: {
    id: 'tokyohot',
    label: 'Tokyo-Hot',
    accentClass: 'from-gray-600 to-slate-500',
    textClass: 'text-gray-300',
    description: '過激な無修正動画',
    siteUrl: 'https://www.tokyo-hot.com/',
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
