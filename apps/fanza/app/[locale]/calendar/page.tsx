import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { generateBaseMetadata } from '@/lib/seo';
import { JsonLD } from '@/components/JsonLD';
import Breadcrumb from '@/components/Breadcrumb';
import PageLayout from '@/components/PageLayout';
import ProductListFilter from '@/components/ProductListFilter';
import ActiveFiltersChips from '@/components/ActiveFiltersChips';
import { getCalendarDetailData, getDailyReleases } from '@adult-v/shared/db-queries';
import { CalendarGridWrapper } from '@adult-v/shared/components/stats';
import { localizedHref } from '@adult-v/shared/i18n';
import { getSaleProducts, getPopularTags, getUncategorizedProductsCount } from '@/lib/db/queries';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  const titles: Record<string, string> = {
    ja: 'リリースカレンダー | 新作AV発売日一覧',
    en: 'Release Calendar | New AV Release Dates',
    zh: '发行日历 | 新作AV发售日一览',
    ko: '출시 캘린더 | 신작 AV 발매일 목록',
  };

  const descriptions: Record<string, string> = {
    ja: 'AV作品のリリースカレンダー。月別・日別の新作発売日を一覧で確認。発売予定の作品もチェックできます。',
    en: 'AV release calendar. Check new releases by month and day. View upcoming releases.',
    zh: 'AV作品发行日历。按月、按日查看新作发售日。还可以查看即将发售的作品。',
    ko: 'AV 작품 출시 캘린더. 월별, 일별 신작 발매일 확인. 출시 예정 작품도 확인 가능.',
  };

  return generateBaseMetadata(
    titles[locale] || titles.ja,
    descriptions[locale] || descriptions.ja,
    undefined,
    '/calendar',
    undefined,
    locale,
  );
}

export default async function CalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const { locale } = await params;
  const { year, month } = await searchParams;
  const tNav = await getTranslations({ locale, namespace: 'nav' });

  const currentDate = new Date();
  const targetYear = year ? parseInt(year, 10) : currentDate.getFullYear();
  const targetMonth = month ? parseInt(month, 10) : currentDate.getMonth() + 1;

  // カレンダー詳細データ、日別リリース数、セール情報、フィルター用データ、未整理商品数を並列取得
  const [calendarData, dailyReleases, saleProducts, popularTags, uncategorizedCount] = await Promise.all([
    getCalendarDetailData(targetYear, targetMonth, 4, 2),
    getDailyReleases(targetYear, targetMonth),
    getSaleProducts({ limit: 24, minDiscount: 30, aspName: 'FANZA' }),
    getPopularTags({ limit: 50 }),
    getUncategorizedProductsCount({ includeAsp: ['FANZA'] }),
  ]);

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'リリースカレンダー',
    description: 'AV作品の新作リリースカレンダー',
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: dailyReleases.length,
      itemListElement: dailyReleases.map((day, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'Event',
          name: `${day.date} 新作リリース`,
          description: `${day.releaseCount}作品リリース`,
          startDate: day.date,
        },
      })),
    },
  };

  const pageTitle: Record<string, string> = {
    ja: 'リリースカレンダー',
    en: 'Release Calendar',
    zh: '发行日历',
    ko: '출시 캘린더',
  };

  // SalesSection用にDateをstringに変換
  const saleProductsForDisplay = saleProducts.map(p => ({
    ...p,
    endAt: p.endAt ? p.endAt.toISOString() : null,
  }));

  // タグをProductListFilter用に変換
  const genreTagsForFilter = popularTags.map(tag => ({
    id: tag.id,
    name: tag.name,
    count: tag.count,
  }));

  // PageLayout用の翻訳
  const layoutTranslations = {
    viewProductList: pageTitle[locale] || pageTitle.ja,
    viewProductListDesc: '',
    uncategorizedBadge: '未整理',
    uncategorizedDescription: '未整理作品',
    uncategorizedCount: `${uncategorizedCount.toLocaleString()}件`,
  };

  return (
    <PageLayout
      locale={locale}
      saleProducts={saleProductsForDisplay}
      uncategorizedCount={uncategorizedCount}
      isTopPage={false}
      translations={layoutTranslations}
    >
      {/* 構造化データ */}
      <JsonLD data={structuredData} />

      <section className="py-3 sm:py-4 md:py-6">
        <div className="container mx-auto px-3 sm:px-4">
          <Breadcrumb
            items={[
              { label: tNav('home'), href: localizedHref('/', locale) },
              { label: pageTitle[locale] || pageTitle.ja },
            ]}
            className="mb-2 sm:mb-3"
          />

          <div className="mb-2 sm:mb-3">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold theme-text mb-0.5">
              {pageTitle[locale] || pageTitle.ja}
            </h1>
          </div>

          {/* アクティブフィルターチップ */}
          <ActiveFiltersChips />

          {/* フィルター設定 */}
          <ProductListFilter
            aspStats={[]}
            genreTags={genreTagsForFilter}
            showInitialFilter={false}
            showPatternFilter={false}
            showGenreFilter={true}
            showAspFilter={false}
            showSampleFilter={true}
            showPerformerTypeFilter={true}
            showUncategorizedFilter={false}
            accentColor="rose"
            defaultOpen={false}
          />

          {/* カレンダーグリッド */}
          <section className="mb-6 sm:mb-8">
            <CalendarGridWrapper
              initialData={calendarData}
              initialYear={targetYear}
              initialMonth={targetMonth}
              locale={locale}
              productLinkPrefix={localizedHref('/products', locale)}
              actressLinkPrefix={localizedHref('/actress', locale)}
            />
          </section>
        </div>
      </section>
    </PageLayout>
  );
}
