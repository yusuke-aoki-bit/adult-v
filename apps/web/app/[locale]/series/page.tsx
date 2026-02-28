import Link from 'next/link';
import { getPopularSeries } from '@/lib/db/queries';
import Breadcrumb from '@/components/Breadcrumb';
import { generateBaseMetadata, generateItemListSchema, generateBreadcrumbSchema } from '@/lib/seo';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Library, Film, Calendar } from 'lucide-react';
import { localizedHref } from '@adult-v/shared/i18n';
import { JsonLD } from '@/components/JsonLD';
import { unstable_cache } from 'next/cache';

// ISR: locale明示でheaders()回避済み → パブリックキャッシュ有効
export const revalidate = 60;

// DB query cache (1800秒)
const getCachedPopularSeries = unstable_cache(
  async (limit: number) => {
    return getPopularSeries(limit);
  },
  ['popular-series'],
  { revalidate: 1800, tags: ['series'] },
);

interface PageProps {
  params: Promise<{ locale: string }>;
}

const translations = {
  ja: {
    title: 'シリーズ一覧',
    description: '人気シリーズ作品を完走しよう',
    products: '作品',
    latestRelease: '最新',
    viewSeries: 'シリーズを見る',
  },
  en: {
    title: 'Series List',
    description: 'Complete popular series',
    products: 'products',
    latestRelease: 'Latest',
    viewSeries: 'View series',
  },
  zh: {
    title: '系列列表',
    description: '完成热门系列',
    products: '作品',
    latestRelease: '最新',
    viewSeries: '查看系列',
  },
  'zh-TW': {
    title: '系列列表',
    description: '完成熱門系列',
    products: '作品',
    latestRelease: '最新',
    viewSeries: '查看系列',
  },
  ko: {
    title: '시리즈 목록',
    description: '인기 시리즈를 정복하세요',
    products: '작품',
    latestRelease: '최신',
    viewSeries: '시리즈 보기',
  },
} as const;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = translations[locale as keyof typeof translations] || translations['ja'];
  const baseUrl = process.env['NEXT_PUBLIC_SITE_URL'] || 'https://example.com';

  return {
    ...generateBaseMetadata(t.title, t.description, undefined, localizedHref('/series', locale), undefined, locale),
    alternates: {
      canonical: `${baseUrl}/series`,
      languages: {
        ja: `${baseUrl}/series`,
        en: `${baseUrl}/series?hl=en`,
        zh: `${baseUrl}/series?hl=zh`,
        'zh-TW': `${baseUrl}/series?hl=zh-TW`,
        ko: `${baseUrl}/series?hl=ko`,
        'x-default': `${baseUrl}/series`,
      },
    },
  };
}

export default async function SeriesListPage({ params }: PageProps) {
  const { locale } = await params;
  const tNav = await getTranslations({ locale, namespace: 'nav' });
  const t = translations[locale as keyof typeof translations] || translations['ja'];

  const series = await getCachedPopularSeries(50);

  const getLocalizedName = (s: (typeof series)[0]) => {
    if (locale === 'en' && s.nameEn) return s.nameEn;
    if (locale === 'zh' && s.nameZh) return s.nameZh;
    if (locale === 'ko' && s.nameKo) return s.nameKo;
    return s.name;
  };

  // Breadcrumb data for schema
  const breadcrumbItems = [
    { name: tNav('home'), url: localizedHref('/', locale) },
    { name: t.title, url: localizedHref('/series', locale) },
  ];

  // ItemList data for schema (top 30 series)
  const itemListData = series.slice(0, 30).map((s) => ({
    name: getLocalizedName(s),
    url: localizedHref(`/series/${s.id}`, locale),
  }));

  return (
    <>
      <JsonLD data={[generateBreadcrumbSchema(breadcrumbItems), generateItemListSchema(itemListData, t.title)]} />
      <div className="theme-body min-h-screen">
        <div className="container mx-auto px-4 py-8">
          <Breadcrumb
            items={[{ label: tNav('home'), href: localizedHref('/', locale) }, { label: t.title }]}
            className="mb-6"
          />

          <div className="mb-8 flex items-center gap-3">
            <Library className="h-8 w-8 text-purple-500" />
            <div>
              <h1 className="theme-text text-2xl font-bold sm:text-3xl">{t.title}</h1>
              <p className="theme-text-muted text-sm">{t.description}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {series.map((s) => (
              <Link
                key={s.id}
                href={localizedHref(`/series/${s.id}`, locale)}
                className="theme-card group rounded-lg p-4 transition-shadow hover:shadow-lg"
              >
                <h2 className="theme-text line-clamp-2 text-lg font-bold transition-colors group-hover:text-purple-400">
                  {getLocalizedName(s)}
                </h2>
                <div className="theme-text-muted mt-3 flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1">
                    <Film className="h-4 w-4" />
                    {s.productCount} {t.products}
                  </span>
                  {s.latestReleaseDate && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {t.latestRelease}: {s.latestReleaseDate.split('T')[0]}
                    </span>
                  )}
                </div>
                <div className="mt-3 text-sm text-purple-400 transition-colors group-hover:text-purple-300">
                  {t.viewSeries} &rarr;
                </div>
              </Link>
            ))}
          </div>

          {series.length === 0 && <p className="theme-text-muted py-12 text-center">No series found</p>}
        </div>
      </div>
    </>
  );
}
