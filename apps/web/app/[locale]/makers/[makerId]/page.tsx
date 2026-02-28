import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Building2, Tag, Users, Film, Star, TrendingUp, Calendar } from 'lucide-react';
import { localizedHref } from '@adult-v/shared/i18n';
import { HomeSectionManager } from '@adult-v/shared/components';
import { getMakerById } from '@/lib/db/queries';
import { generateBaseMetadata, generateBreadcrumbSchema, generateItemListSchema } from '@/lib/seo';
import { JsonLD } from '@/components/JsonLD';
import Breadcrumb from '@/components/Breadcrumb';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

// ISR: locale明示でheaders()回避済み → パブリックキャッシュ有効
export const revalidate = 60;

interface PageProps {
  params: Promise<{ makerId: string; locale: string }>;
}

const translations = {
  ja: {
    notFound: 'メーカーが見つかりません',
    backToList: 'メーカー一覧に戻る',
    products: '作品',
    rating: '平均評価',
    topPerformers: '人気女優',
    topGenres: '人気ジャンル',
    yearlyProduction: '年別作品数',
    recentProducts: '最新作品',
    viewAll: 'すべて見る',
    viewProducts: '作品を見る',
    maker: 'メーカー',
    label: 'レーベル',
    works: '作品',
    makerList: 'メーカー一覧',
  },
  en: {
    notFound: 'Maker not found',
    backToList: 'Back to makers',
    products: 'products',
    rating: 'Average Rating',
    topPerformers: 'Top Performers',
    topGenres: 'Top Genres',
    yearlyProduction: 'Yearly Production',
    recentProducts: 'Recent Products',
    viewAll: 'View All',
    viewProducts: 'View Products',
    maker: 'Maker',
    label: 'Label',
    works: 'works',
    makerList: 'Makers',
  },
  zh: {
    notFound: '未找到厂商',
    backToList: '返回厂商列表',
    products: '部作品',
    rating: '平均评分',
    topPerformers: '人气女优',
    topGenres: '人气类型',
    yearlyProduction: '年度作品数',
    recentProducts: '最新作品',
    viewAll: '查看全部',
    viewProducts: '查看作品',
    maker: '厂商',
    label: '品牌',
    works: '部',
    makerList: '厂商列表',
  },
  'zh-TW': {
    notFound: '未找到廠商',
    backToList: '返回廠商列表',
    products: '部作品',
    rating: '平均評分',
    topPerformers: '人氣女優',
    topGenres: '人氣類型',
    yearlyProduction: '年度作品數',
    recentProducts: '最新作品',
    viewAll: '查看全部',
    viewProducts: '查看作品',
    maker: '廠商',
    label: '品牌',
    works: '部',
    makerList: '廠商列表',
  },
  ko: {
    notFound: '메이커를 찾을 수 없습니다',
    backToList: '메이커 목록으로',
    products: '작품',
    rating: '평균 평점',
    topPerformers: '인기 배우',
    topGenres: '인기 장르',
    yearlyProduction: '연도별 작품 수',
    recentProducts: '최신 작품',
    viewAll: '전체 보기',
    viewProducts: '작품 보기',
    maker: '메이커',
    label: '레이블',
    works: '작품',
    makerList: '메이커 목록',
  },
} as const;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const { makerId, locale } = await params;
    const makerIdNum = parseInt(makerId, 10);
    if (isNaN(makerIdNum)) return {};

    const maker = await getMakerById(makerIdNum, locale);
    if (!maker) return {};

    const t = translations[locale as keyof typeof translations] || translations['ja'];
    const categoryLabel = maker.category === 'maker' ? t.maker : t.label;
    const baseUrl = process.env['NEXT_PUBLIC_SITE_URL'] || 'https://example.com';

    return {
      ...generateBaseMetadata(
        `${maker.name} - ${categoryLabel} (${maker.productCount}${t.products})`,
        `${maker.name}の${t.products}一覧。${maker.productCount}${t.products}を掲載。`,
        undefined,
        localizedHref(`/makers/${makerId}`, locale),
        undefined,
        locale,
      ),
      alternates: {
        canonical: `${baseUrl}/makers/${makerId}`,
        languages: {
          ja: `${baseUrl}/makers/${makerId}`,
          en: `${baseUrl}/makers/${makerId}?hl=en`,
          zh: `${baseUrl}/makers/${makerId}?hl=zh`,
          'zh-TW': `${baseUrl}/makers/${makerId}?hl=zh-TW`,
          ko: `${baseUrl}/makers/${makerId}?hl=ko`,
          'x-default': `${baseUrl}/makers/${makerId}`,
        },
      },
    };
  } catch {
    return {};
  }
}

export default async function MakerDetailPage({ params }: PageProps) {
  const { makerId, locale } = await params;
  const t = translations[locale as keyof typeof translations] || translations['ja'];

  const makerIdNum = parseInt(makerId, 10);
  if (isNaN(makerIdNum)) notFound();

  let tNav, maker;
  try {
    [tNav, maker] = await Promise.all([
      getTranslations({ locale, namespace: 'nav' }),
      getMakerById(makerIdNum, locale),
    ]);
  } catch (error) {
    console.error(`[maker-detail] Error loading maker ${makerId}:`, error);
    notFound();
  }
  if (!maker) notFound();

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: tNav('home'), url: localizedHref('/', locale) },
    { name: t.makerList, url: localizedHref('/makers', locale) },
    { name: maker.name, url: localizedHref(`/makers/${makerId}`, locale) },
  ]);

  const itemListSchema = generateItemListSchema(
    maker.recentProducts.map((product) => ({
      name: product.title,
      url: localizedHref(`/products/${product.id}`, locale),
    })),
    maker.name,
  );

  const maxYearlyCount = Math.max(...maker.yearlyStats.map((y) => y.count), 1);

  return (
    <>
      <JsonLD data={breadcrumbSchema} />
      <JsonLD data={itemListSchema} />
      <div className="theme-body min-h-screen">
        <div className="container mx-auto px-4 py-8">
          {/* Breadcrumb */}
          <Breadcrumb
            items={[
              { label: tNav('home'), href: localizedHref('/', locale) },
              { label: t.makerList, href: localizedHref('/makers', locale) },
              { label: maker.name },
            ]}
            className="mb-4"
          />

          {/* PR表記（景品表示法・ステマ規制対応） */}
          <p className="theme-text-muted mb-6 text-xs">
            <span className="mr-1.5 rounded bg-yellow-900/30 px-1.5 py-0.5 font-bold text-yellow-400">PR</span>
            当ページには広告・アフィリエイトリンクが含まれています
          </p>

          {/* Header */}
          <div className="mb-6 rounded-xl bg-gray-800 p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-linear-to-br from-blue-500 to-purple-600">
                {maker.category === 'maker' ? (
                  <Building2 className="h-8 w-8 text-white" />
                ) : (
                  <Tag className="h-8 w-8 text-white" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold text-white">{maker.name}</h1>
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      maker.category === 'maker' ? 'bg-blue-900 text-blue-300' : 'bg-purple-900 text-purple-300'
                    }`}
                  >
                    {maker.category === 'maker' ? t.maker : t.label}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-4 text-gray-400">
                  <span className="flex items-center gap-1">
                    <Film className="h-4 w-4" />
                    {maker.productCount.toLocaleString()} {t.products}
                  </span>
                  {maker.averageRating && (
                    <span className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-yellow-400" />
                      {maker.averageRating.toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Main Content */}
            <div className="space-y-6 lg:col-span-2">
              {/* Yearly Stats */}
              {maker.yearlyStats.length > 0 && (
                <div className="rounded-xl bg-gray-800 p-6">
                  <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
                    <Calendar className="h-5 w-5 text-blue-400" />
                    {t.yearlyProduction}
                  </h2>
                  <div className="space-y-2">
                    {maker.yearlyStats
                      .slice(0, 8)
                      .reverse()
                      .map((stat) => (
                        <div key={stat.year} className="flex items-center gap-3">
                          <span className="w-12 text-sm text-gray-400">{stat.year}</span>
                          <div className="h-6 flex-1 overflow-hidden rounded-full bg-gray-700">
                            <div
                              className="flex h-full items-center justify-end rounded-full bg-linear-to-r from-blue-500 to-purple-500 pr-2"
                              style={{ width: `${(stat.count / maxYearlyCount) * 100}%` }}
                            >
                              <span className="text-xs font-medium text-white">{stat.count}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Recent Products */}
              {maker.recentProducts.length > 0 && (
                <div className="rounded-xl bg-gray-800 p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                      <TrendingUp className="h-5 w-5 text-green-400" />
                      {t.recentProducts}
                    </h2>
                    <Link
                      href={localizedHref(`/products?maker=${maker.id}`, locale)}
                      className="text-sm text-blue-400 hover:text-blue-300"
                    >
                      {t.viewAll} →
                    </Link>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                    {maker.recentProducts.map((product) => (
                      <Link key={product.id} href={localizedHref(`/products/${product.id}`, locale)} className="group">
                        <div className="relative overflow-hidden rounded-lg bg-gray-700" style={{ aspectRatio: '2/3' }}>
                          {product.imageUrl ? (
                            <Image
                              src={product.imageUrl}
                              alt={product.title}
                              fill
                              className="object-cover transition-transform group-hover:scale-105"
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Film className="h-8 w-8 text-gray-500" />
                            </div>
                          )}
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-gray-400 transition-colors group-hover:text-white">
                          {product.title}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Top Performers */}
              {maker.topPerformers.length > 0 && (
                <div className="rounded-xl bg-gray-800 p-6">
                  <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
                    <Users className="h-5 w-5 text-pink-400" />
                    {t.topPerformers}
                  </h2>
                  <div className="space-y-3">
                    {maker.topPerformers.map((performer, index) => (
                      <Link
                        key={performer.id}
                        href={localizedHref(`/actress/${performer.id}`, locale)}
                        className="flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-gray-700"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                              index === 0
                                ? 'bg-yellow-500 text-black'
                                : index === 1
                                  ? 'bg-gray-400 text-black'
                                  : index === 2
                                    ? 'bg-amber-600 text-white'
                                    : 'bg-gray-700 text-gray-300'
                            }`}
                          >
                            {index + 1}
                          </span>
                          <span className="text-white">{performer.name}</span>
                        </div>
                        <span className="text-sm text-gray-400">
                          {performer.productCount} {t.works}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Top Genres */}
              {maker.topGenres.length > 0 && (
                <div className="rounded-xl bg-gray-800 p-6">
                  <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
                    <Tag className="h-5 w-5 text-purple-400" />
                    {t.topGenres}
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {maker.topGenres.map((genre) => (
                      <Link
                        key={genre.id}
                        href={localizedHref(`/products?include=${genre.id}`, locale)}
                        className="rounded-full bg-gray-700 px-3 py-1.5 text-sm text-gray-300 transition-colors hover:bg-gray-600 hover:text-white"
                      >
                        {genre.name}
                        <span className="ml-1 text-gray-500">({genre.productCount})</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* View All Products Button */}
              <Link
                href={localizedHref(`/products?maker=${maker.id}`, locale)}
                className="block w-full rounded-xl bg-blue-600 py-3 text-center font-semibold text-white transition-colors hover:bg-blue-500"
              >
                {t.viewProducts} ({maker.productCount})
              </Link>
            </div>
          </div>

          {/* セクションカスタマイズ */}
          <HomeSectionManager locale={locale} theme="dark" pageId="maker" />
        </div>
      </div>
    </>
  );
}
