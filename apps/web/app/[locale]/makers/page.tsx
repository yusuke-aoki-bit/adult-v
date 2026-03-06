import { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { generateBaseMetadata } from '@/lib/seo';
import MakersPageClient from './MakersPageClient';

export const revalidate = 60;

const metaTranslations = {
  ja: {
    title: 'メーカー・レーベル一覧',
    description:
      '人気のメーカー・レーベルから作品を探す。DUGA、MGS、DTIなど主要配信サイトのメーカー・レーベル情報を網羅。',
  },
  en: {
    title: 'Makers & Labels',
    description: 'Browse products by popular makers and labels across DUGA, MGS, and DTI platforms.',
  },
  zh: {
    title: '厂商・品牌列表',
    description: '按热门厂商和品牌浏览作品。涵盖DUGA、MGS、DTI等主要平台。',
  },
  'zh-TW': {
    title: '廠商・品牌列表',
    description: '按熱門廠商和品牌瀏覽作品。涵蓋DUGA、MGS、DTI等主要平台。',
  },
  ko: {
    title: '메이커・레이블 목록',
    description: '인기 메이커와 레이블로 작품 검색. DUGA, MGS, DTI 등 주요 플랫폼 정보 제공.',
  },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const mt = metaTranslations[locale as keyof typeof metaTranslations] || metaTranslations.ja;
  return generateBaseMetadata(mt.title, mt.description, undefined, '/makers', undefined, locale);
}

export default async function MakersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <MakersPageClient />;
}
