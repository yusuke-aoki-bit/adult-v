import { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { generateBaseMetadata } from '@/lib/seo';
import DiscoverPageClient from './DiscoverPageClient';

export const revalidate = 60;

const metaTranslations = {
  ja: {
    title: '発掘モード',
    description: 'ランダムに作品を発見。気になる作品をお気に入りに追加して、新しいジャンルを開拓しよう。',
  },
  en: {
    title: 'Discover Mode',
    description: 'Discover random AV works. Add favorites and explore new genres with our discovery feature.',
  },
  zh: {
    title: '发掘模式',
    description: '随机发现作品。将喜欢的作品加入收藏，探索新的类型。',
  },
  'zh-TW': {
    title: '發掘模式',
    description: '隨機發現作品。將喜歡的作品加入收藏，探索新的類型。',
  },
  ko: {
    title: '발굴 모드',
    description: '랜덤으로 작품을 발견하세요. 마음에 드는 작품을 즐겨찾기에 추가하고 새로운 장르를 탐험하세요.',
  },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const mt = metaTranslations[locale as keyof typeof metaTranslations] || metaTranslations.ja;
  return generateBaseMetadata(mt.title, mt.description, undefined, '/discover', undefined, locale);
}

export default async function DiscoverPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <DiscoverPageClient />;
}
