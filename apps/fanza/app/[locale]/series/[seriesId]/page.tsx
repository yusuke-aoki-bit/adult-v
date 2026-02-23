import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getSeriesInfo, getSeriesProducts, SeriesProduct } from '@/lib/db/queries';
import Breadcrumb from '@/components/Breadcrumb';
import ProductCard from '@/components/ProductCard';
import { generateBaseMetadata, generateBreadcrumbSchema } from '@/lib/seo';
import { JsonLD } from '@/components/JsonLD';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Library, Clock, Film, Star, User, Trophy } from 'lucide-react';
import SeriesProgressTracker from '@/components/SeriesProgressTracker';
import { Product } from '@/types/product';
import { localizedHref } from '@adult-v/shared/i18n';
import { HomeSectionManager } from '@adult-v/shared/components';

/**
 * SeriesProduct を ProductCard が期待する Product 型に変換
 */
function toProduct(sp: SeriesProduct): Product {
  return {
    id: sp.id,
    normalizedProductId: sp.normalizedProductId,
    title: sp.title,
    description: '',
    price: sp.price ?? 0,
    category: 'all',
    imageUrl: sp.thumbnail,
    affiliateUrl: '',
    provider: 'duga',
    providerLabel: '',
    performers: sp.performers.map((p) => ({ id: String(p.id), name: p.name })),
    releaseDate: sp.releaseDate,
    duration: sp.duration,
    rating: sp.rating,
    reviewCount: sp.reviewCount,
  };
}

// force-dynamic: next-intlのgetTranslationsがheaders()を内部呼出しするためISR不可
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ seriesId: string; locale: string }>;
  searchParams: Promise<{ sort?: string }>;
}

const translations = {
  ja: {
    completionGuide: '完走ガイド',
    totalProducts: '全{count}作品',
    totalDuration: '総再生時間',
    hours: '時間',
    minutes: '分',
    averageRating: '平均評価',
    topPerformers: '主な出演者',
    sortByRelease: 'リリース順',
    sortByRating: '評価順',
    sortByReleaseDesc: '新しい順',
    progress: '進捗',
    watched: '視聴済み',
    notWatched: '未視聴',
    firstRelease: '第1作',
    latestRelease: '最新作',
    recommended: 'おすすめ',
    backToList: 'シリーズ一覧に戻る',
    noProducts: '作品が見つかりませんでした',
  },
  en: {
    completionGuide: 'Completion Guide',
    totalProducts: '{count} products total',
    totalDuration: 'Total Duration',
    hours: 'hours',
    minutes: 'min',
    averageRating: 'Average Rating',
    topPerformers: 'Top Performers',
    sortByRelease: 'By Release',
    sortByRating: 'By Rating',
    sortByReleaseDesc: 'Newest First',
    progress: 'Progress',
    watched: 'Watched',
    notWatched: 'Not Watched',
    firstRelease: 'First Release',
    latestRelease: 'Latest',
    recommended: 'Recommended',
    backToList: 'Back to Series List',
    noProducts: 'No products found',
  },
  zh: {
    completionGuide: '完成指南',
    totalProducts: '共{count}部作品',
    totalDuration: '总时长',
    hours: '小时',
    minutes: '分钟',
    averageRating: '平均评分',
    topPerformers: '主要演员',
    sortByRelease: '发布顺序',
    sortByRating: '评分排序',
    sortByReleaseDesc: '最新优先',
    progress: '进度',
    watched: '已观看',
    notWatched: '未观看',
    firstRelease: '首作',
    latestRelease: '最新作',
    recommended: '推荐',
    backToList: '返回系列列表',
    noProducts: '未找到作品',
  },
  ko: {
    completionGuide: '정복 가이드',
    totalProducts: '총 {count}작품',
    totalDuration: '총 재생 시간',
    hours: '시간',
    minutes: '분',
    averageRating: '평균 평점',
    topPerformers: '주요 출연자',
    sortByRelease: '출시순',
    sortByRating: '평점순',
    sortByReleaseDesc: '최신순',
    progress: '진행률',
    watched: '시청 완료',
    notWatched: '미시청',
    firstRelease: '첫 작품',
    latestRelease: '최신작',
    recommended: '추천',
    backToList: '시리즈 목록으로',
    noProducts: '작품을 찾을 수 없습니다',
  },
} as const;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const { seriesId, locale } = await params;
    const seriesInfo = await getSeriesInfo(parseInt(seriesId));
    if (!seriesInfo) return {};

    const t = translations[locale as keyof typeof translations] || translations.ja;
    const name =
      locale === 'en' && seriesInfo.nameEn
        ? seriesInfo.nameEn
        : locale === 'zh' && seriesInfo.nameZh
          ? seriesInfo.nameZh
          : locale === 'ko' && seriesInfo.nameKo
            ? seriesInfo.nameKo
            : seriesInfo.name;

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';

    return {
      ...generateBaseMetadata(
        `${name} - ${t.completionGuide}`,
        t.totalProducts.replace('{count}', String(seriesInfo.totalProducts)),
        undefined,
        localizedHref(`/series/${seriesId}`, locale),
        undefined,
        locale,
      ),
      alternates: {
        canonical: `${baseUrl}/series/${seriesId}`,
        languages: {
          ja: `${baseUrl}/series/${seriesId}`,
          en: `${baseUrl}/series/${seriesId}?hl=en`,
          zh: `${baseUrl}/series/${seriesId}?hl=zh`,
          ko: `${baseUrl}/series/${seriesId}?hl=ko`,
          'x-default': `${baseUrl}/series/${seriesId}`,
        },
      },
    };
  } catch {
    return {};
  }
}

export default async function SeriesDetailPage({ params, searchParams }: PageProps) {
  const { seriesId, locale } = await params;
  const { sort } = await searchParams;
  const t = translations[locale as keyof typeof translations] || translations.ja;

  let tNav, seriesInfo;
  try {
    [tNav, seriesInfo] = await Promise.all([getTranslations('nav'), getSeriesInfo(parseInt(seriesId))]);
  } catch (error) {
    console.error(`[series-detail] Error loading series ${seriesId}:`, error);
    notFound();
  }
  if (!seriesInfo) notFound();

  const sortBy = sort === 'rating' ? 'ratingDesc' : sort === 'newest' ? 'releaseDateDesc' : 'releaseDateAsc';

  let products: SeriesProduct[];
  try {
    products = await getSeriesProducts(parseInt(seriesId), { sortBy, locale });
  } catch (error) {
    console.error(`[series-detail] Error loading series products ${seriesId}:`, error);
    notFound();
  }

  const name =
    locale === 'en' && seriesInfo.nameEn
      ? seriesInfo.nameEn
      : locale === 'zh' && seriesInfo.nameZh
        ? seriesInfo.nameZh
        : locale === 'ko' && seriesInfo.nameKo
          ? seriesInfo.nameKo
          : seriesInfo.name;

  const totalHours = Math.floor(seriesInfo.totalDuration / 60);
  const totalMinutes = seriesInfo.totalDuration % 60;

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: tNav('home'), url: localizedHref('/', locale) },
    { name: t.completionGuide.replace('{name}', ''), url: localizedHref('/series', locale) },
    { name: name, url: localizedHref(`/series/${seriesId}`, locale) },
  ]);

  return (
    <>
      <JsonLD data={breadcrumbSchema} />
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <Breadcrumb
            items={[
              { label: tNav('home'), href: localizedHref('/', locale) },
              { label: t.backToList.split(' ')[0]!, href: localizedHref('/series', locale) },
              { label: name },
            ]}
            className="mb-6"
          />

          {/* Header */}
          <div className="mb-8 rounded-lg bg-white p-6 shadow">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-purple-100 p-3">
                <Library className="h-8 w-8 text-purple-600" />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{name}</h1>
                <p className="mt-1 text-lg text-gray-500">{t.completionGuide}</p>
              </div>
            </div>

            {/* Stats */}
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-lg bg-gray-50 p-4">
                <div className="mb-1 flex items-center gap-2 text-gray-500">
                  <Film className="h-4 w-4" />
                  <span className="text-sm">{t.totalProducts.split('{count}')[0]}</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{seriesInfo.totalProducts}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <div className="mb-1 flex items-center gap-2 text-gray-500">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm">{t.totalDuration}</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {totalHours > 0 && (
                    <>
                      {totalHours}
                      <span className="text-sm">{t.hours}</span>
                    </>
                  )}
                  {totalMinutes}
                  <span className="text-sm">{t.minutes}</span>
                </p>
              </div>
              {seriesInfo.averageRating && (
                <div className="rounded-lg bg-gray-50 p-4">
                  <div className="mb-1 flex items-center gap-2 text-gray-500">
                    <Star className="h-4 w-4" />
                    <span className="text-sm">{t.averageRating}</span>
                  </div>
                  <p className="flex items-center gap-1 text-2xl font-bold text-gray-900">
                    {seriesInfo.averageRating.toFixed(1)}
                    <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  </p>
                </div>
              )}
              <div className="rounded-lg bg-gray-50 p-4">
                <div className="mb-1 flex items-center gap-2 text-gray-500">
                  <Trophy className="h-4 w-4" />
                  <span className="text-sm">{t.progress}</span>
                </div>
                <SeriesProgressTracker
                  seriesId={seriesId}
                  totalProducts={seriesInfo.totalProducts}
                  productIds={products.map((p) => p.id)}
                  translations={{ watched: t.watched, notWatched: t.notWatched }}
                />
              </div>
            </div>

            {/* Top performers */}
            {seriesInfo.topPerformers.length > 0 && (
              <div className="mt-6">
                <h3 className="mb-2 flex items-center gap-2 text-sm text-gray-500">
                  <User className="h-4 w-4" />
                  {t.topPerformers}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {seriesInfo.topPerformers.map((p) => (
                    <Link
                      key={p.id}
                      href={localizedHref(`/actress/${p.id}`, locale)}
                      className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700 transition-colors hover:bg-gray-200"
                    >
                      {p.name} ({p.count})
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sort options */}
          <div className="mb-6 flex items-center justify-between">
            <p className="text-gray-500">{t.totalProducts.replace('{count}', String(products.length))}</p>
            <div className="flex gap-2">
              <Link
                href={localizedHref(`/series/${seriesId}`, locale)}
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  !sort || sort === 'release'
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {t.sortByRelease}
              </Link>
              <Link
                href={`${localizedHref(`/series/${seriesId}`, locale)}&sort=newest`}
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  sort === 'newest' ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {t.sortByReleaseDesc}
              </Link>
              <Link
                href={`${localizedHref(`/series/${seriesId}`, locale)}&sort=rating`}
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  sort === 'rating' ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {t.sortByRating}
              </Link>
            </div>
          </div>

          {/* Products grid */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {products.map((product, index) => (
              <div key={product.id} className="relative">
                {/* Number badge */}
                <div className="absolute top-2 left-2 z-10 rounded bg-purple-600/90 px-2 py-0.5 text-xs font-bold text-white">
                  #{index + 1}
                </div>
                {/* Recommended badge (top 3 by rating) */}
                {sort === 'rating' && index < 3 && (
                  <div className="absolute top-2 right-2 z-10 flex items-center gap-1 rounded bg-yellow-500/90 px-2 py-0.5 text-xs font-bold text-black">
                    <Trophy className="h-3 w-3" />
                    {t.recommended}
                  </div>
                )}
                <ProductCard product={toProduct(product)} />
              </div>
            ))}
          </div>

          {products.length === 0 && <p className="py-12 text-center text-gray-500">{t.noProducts}</p>}

          {/* Back link */}
          <div className="mt-8 text-center">
            <Link
              href={localizedHref('/series', locale)}
              className="inline-flex items-center gap-2 text-purple-600 transition-colors hover:text-purple-500"
            >
              &larr; {t.backToList}
            </Link>
          </div>

          {/* セクションカスタマイズ */}
          <HomeSectionManager locale={locale} theme="light" pageId="series" />
        </div>
      </div>
    </>
  );
}
