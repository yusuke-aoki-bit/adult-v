import { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { generateBaseMetadata, generateBreadcrumbSchema, generateCollectionPageSchema } from '@/lib/seo';
import { JsonLD } from '@/components/JsonLD';
import { localizedHref } from '@adult-v/shared/i18n';
import ListsPageClient from './ListsPageClient';

export const revalidate = 60;

const metaTranslations = {
  ja: {
    title: '公開リスト',
    description: 'ユーザーが作成したおすすめリストを探索。人気作品のまとめやジャンル別おすすめをチェック。',
  },
  en: {
    title: 'Public Lists',
    description: 'Explore curated lists from users. Check popular product collections and genre-based recommendations.',
  },
  zh: {
    title: '公开列表',
    description: '探索用户创建的推荐列表。查看热门作品合集和按类型推荐。',
  },
  'zh-TW': {
    title: '公開列表',
    description: '探索使用者建立的推薦列表。查看熱門作品合集和按類型推薦。',
  },
  ko: {
    title: '공개 리스트',
    description: '사용자가 만든 추천 리스트 탐색. 인기 작품 모음과 장르별 추천을 확인하세요.',
  },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const mt = metaTranslations[locale as keyof typeof metaTranslations] || metaTranslations.ja;
  return generateBaseMetadata(mt.title, mt.description, undefined, '/lists', undefined, locale);
}

export default async function ListsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const mt = metaTranslations[locale as keyof typeof metaTranslations] || metaTranslations.ja;
  const BASE_URL = process.env['NEXT_PUBLIC_SITE_URL'] || 'https://www.adult-v.com';

  let initialPublicLists = [];
  try {
    const res = await fetch(`${BASE_URL}/api/favorite-lists?page=1&limit=20`, {
      next: { revalidate: 60 },
    });
    if (res.ok) {
      const data = await res.json();
      initialPublicLists = data.lists || [];
    }
  } catch {
    // SSR fetch failure is non-critical; client will fetch on mount
  }

  return (
    <>
      <JsonLD
        data={[
          generateBreadcrumbSchema([
            { name: 'Home', url: '/' },
            { name: mt.title, url: localizedHref('/lists', locale) },
          ]),
          generateCollectionPageSchema(mt.title, mt.description, localizedHref('/lists', locale), locale),
        ]}
      />
      <ListsPageClient initialPublicLists={initialPublicLists} />
    </>
  );
}
