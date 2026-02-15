import type { ProviderId, ProviderMeta } from './types/product';

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
  heydouga: {
    id: 'heydouga',
    label: 'HEYDOUGA',
    accentClass: 'from-teal-500 to-cyan-500',
    textClass: 'text-teal-300',
    description: 'アマチュア動画配信',
    siteUrl: 'https://www.heydouga.com/',
  },
  x1x: {
    id: 'x1x',
    label: 'X1X',
    accentClass: 'from-red-500 to-pink-500',
    textClass: 'text-red-300',
    description: '無修正動画サイト',
    siteUrl: 'https://www.x1x.com/',
  },
  enkou55: {
    id: 'enkou55',
    label: 'ENKOU55',
    accentClass: 'from-amber-500 to-yellow-500',
    textClass: 'text-amber-300',
    description: '援交系動画サイト',
    siteUrl: 'https://www.enkou55.com/',
  },
  urekko: {
    id: 'urekko',
    label: 'UREKKO',
    accentClass: 'from-green-500 to-emerald-500',
    textClass: 'text-green-300',
    description: '人気動画サイト',
    siteUrl: 'https://www.urekko.net/',
  },
  tvdeav: {
    id: 'tvdeav',
    label: 'TVDEAV',
    accentClass: 'from-teal-600 to-emerald-500',
    textClass: 'text-teal-300',
    description: 'TV出演AV女優の動画配信',
    siteUrl: 'https://tvdeav.com/',
  },
  av9898: {
    id: 'av9898',
    label: 'AV9898',
    accentClass: 'from-gray-500 to-slate-500',
    textClass: 'text-gray-300',
    description: '無修正動画配信サイト',
    siteUrl: 'https://www.av9898.com/',
  },
  honnamatv: {
    id: 'honnamatv',
    label: 'ホンナマTV',
    accentClass: 'from-gray-500 to-zinc-500',
    textClass: 'text-gray-300',
    description: '生ハメ無修正動画',
    siteUrl: 'https://www.honnamatv.com/',
  },
};

/**
 * サブスクリプション型（月額制）プロバイダーのリスト
 */
export const SUBSCRIPTION_PROVIDERS = [
  'dti',
  'caribbeancom',
  'caribbeancompr',
  '1pondo',
  'heyzo',
  '10musume',
  'pacopacomama',
  'muramura',
  'tokyohot',
  'japanska',
] as const;

/**
 * サブスクリプション型（月額制）プロバイダーかどうか判定
 * DTI系サービスとJapanskaが該当
 */
export function isSubscriptionProvider(aspName: string): boolean {
  const name = aspName.toLowerCase();
  return SUBSCRIPTION_PROVIDERS.includes(name as typeof SUBSCRIPTION_PROVIDERS[number]);
}

/**
 * サブスクリプションプロバイダーの説明テキストを取得
 */
export function getSubscriptionDescription(aspName: string): string | null {
  if (!isSubscriptionProvider(aspName)) return null;

  const normalized = aspName.toLowerCase();
  switch (normalized) {
    case 'dti':
      return '月額見放題サービス';
    case 'japanska':
      return '月額ストリーミングサービス';
    default:
      return '月額制サービス';
  }
}

/**
 * 価格をフォーマット（通貨対応）
 *
 * USDはセント単位で保存されているため100で割って表示
 * JPYはそのまま表示
 */
export function formatPrice(price: number, currency: string = 'JPY'): string {
  if (currency === 'USD') {
    const dollars = price / 100;
    return `$${dollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `¥${price.toLocaleString()}`;
}

/**
 * 価格表示用のフォーマット
 * サブスクリプションプロバイダーの場合は「月額」を付加
 */
export function formatPriceWithSubscription(aspName: string, price: number | null): string {
  if (price === null || price === 0) {
    if (isSubscriptionProvider(aspName)) {
      return '月額制';
    }
    return '価格未設定';
  }

  const formattedPrice = `¥${price.toLocaleString()}`;

  if (isSubscriptionProvider(aspName)) {
    return `${formattedPrice}/月`;
  }

  return formattedPrice;
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
