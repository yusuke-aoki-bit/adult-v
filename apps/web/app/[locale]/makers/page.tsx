import { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { unstable_cache } from 'next/cache';
import { generateBaseMetadata, generateBreadcrumbSchema, generateCollectionPageSchema } from '@/lib/seo';
import { JsonLD } from '@/components/JsonLD';
import { localizedHref } from '@adult-v/shared/i18n';
import { getPopularMakers } from '@/lib/db/queries';
import MakersPageClient from './MakersPageClient';

export const revalidate = 3600;

const getCachedMakers = unstable_cache(
  async (locale: string) => getPopularMakers({ category: 'both', limit: 100, locale }),
  ['makers-page'],
  { revalidate: 3600 },
);

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
  const mt = metaTranslations[locale as keyof typeof metaTranslations] || metaTranslations.ja;
  const BASE_URL = process.env['NEXT_PUBLIC_SITE_URL'] || 'https://www.adult-v.com';

  const makers = await getCachedMakers(locale);

  return (
    <>
      <JsonLD
        data={[
          generateBreadcrumbSchema([
            { name: 'Home', url: BASE_URL },
            { name: mt.title, url: `${BASE_URL}${localizedHref('/makers', locale)}` },
          ]),
          generateCollectionPageSchema(mt.title, mt.description, `${BASE_URL}/makers`, locale),
        ]}
      />
      <MakersPageClient initialMakers={makers} />
    </>
  );
}
