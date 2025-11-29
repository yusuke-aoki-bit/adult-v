import type { ProviderId, ProviderMeta } from '@/types/product';

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
  fc2: {
    id: 'fc2',
    label: 'FC2',
    accentClass: 'from-indigo-500 to-violet-500',
    textClass: 'text-indigo-300',
    description: '素人投稿動画プラットフォーム',
    siteUrl: 'https://adult.contents.fc2.com/',
  },
};


