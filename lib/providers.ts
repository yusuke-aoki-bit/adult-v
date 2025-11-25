import type { ProviderId, ProviderMeta } from '@/types/product';

/**
 * プロバイダーメタデータ（クライアントサイドでも使用可能）
 */
export const providerMeta: Record<ProviderId, ProviderMeta> = {
  dmm: {
    id: 'dmm',
    label: 'DMM',
    accentClass: 'from-pink-600 to-orange-500',
    textClass: 'text-pink-300',
    description: '王道ラインナップとVR/4Kに強い国内最大級プラットフォーム',
    siteUrl: 'https://www.dmm.co.jp/digital/videoa/',
  },
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
  // DTI is hidden per DMM affiliate terms but kept for internal use
  dti: {
    id: 'dti',
    label: 'DTI',
    accentClass: 'from-red-600 to-rose-500',
    textClass: 'text-rose-300',
    description: 'DTI affiliated sites (hidden from public)',
    siteUrl: 'https://www.dti.ne.jp/',
  },
};


