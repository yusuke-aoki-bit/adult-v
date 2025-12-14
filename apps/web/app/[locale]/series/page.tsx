import Link from 'next/link';
import { getPopularSeries } from '@/lib/db/queries';
import Breadcrumb from '@/components/Breadcrumb';
import { generateBaseMetadata } from '@/lib/seo';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Library, Film, Calendar } from 'lucide-react';

export const dynamic = 'force-dynamic';

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
  const t = translations[locale as keyof typeof translations] || translations.ja;

  return generateBaseMetadata(
    t.title,
    t.description,
    undefined,
    `/${locale}/series`,
    undefined,
    locale
  );
}

export default async function SeriesListPage({ params }: PageProps) {
  const { locale } = await params;
  const tNav = await getTranslations('nav');
  const t = translations[locale as keyof typeof translations] || translations.ja;

  const series = await getPopularSeries(50);

  const getLocalizedName = (s: typeof series[0]) => {
    if (locale === 'en' && s.nameEn) return s.nameEn;
    if (locale === 'zh' && s.nameZh) return s.nameZh;
    if (locale === 'ko' && s.nameKo) return s.nameKo;
    return s.name;
  };

  return (
    <div className="theme-body min-h-screen">
      <div className="container mx-auto px-4 py-8">
        <Breadcrumb
          items={[
            { label: tNav('home'), href: `/${locale}` },
            { label: t.title },
          ]}
          className="mb-6"
        />

        <div className="flex items-center gap-3 mb-8">
          <Library className="w-8 h-8 text-purple-500" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold theme-text">{t.title}</h1>
            <p className="text-sm theme-text-muted">{t.description}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {series.map((s) => (
            <Link
              key={s.id}
              href={`/${locale}/series/${s.id}`}
              className="theme-card rounded-lg p-4 hover:shadow-lg transition-shadow group"
            >
              <h2 className="text-lg font-bold theme-text group-hover:text-purple-400 transition-colors line-clamp-2">
                {getLocalizedName(s)}
              </h2>
              <div className="mt-3 flex items-center gap-4 text-sm theme-text-muted">
                <span className="flex items-center gap-1">
                  <Film className="w-4 h-4" />
                  {s.productCount} {t.products}
                </span>
                {s.latestReleaseDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {t.latestRelease}: {s.latestReleaseDate.split('T')[0]}
                  </span>
                )}
              </div>
              <div className="mt-3 text-sm text-purple-400 group-hover:text-purple-300 transition-colors">
                {t.viewSeries} &rarr;
              </div>
            </Link>
          ))}
        </div>

        {series.length === 0 && (
          <p className="text-center theme-text-muted py-12">
            No series found
          </p>
        )}
      </div>
    </div>
  );
}
