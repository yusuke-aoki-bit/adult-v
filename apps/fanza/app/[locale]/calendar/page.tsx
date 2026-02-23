import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { generateBaseMetadata } from '@/lib/seo';
import { JsonLD } from '@/components/JsonLD';
import Breadcrumb from '@/components/Breadcrumb';
import ProductListFilter from '@/components/ProductListFilter';
import ActiveFiltersChips from '@/components/ActiveFiltersChips';
import { getCalendarDetailData, getDailyReleases } from '@adult-v/shared/db-queries';
import { CalendarGridWrapper } from '@adult-v/shared/components/stats';
import { localizedHref } from '@adult-v/shared/i18n';
import { getPopularTags } from '@/lib/db/queries';

// force-dynamic: next-intlのgetTranslationsがheaders()を内部呼出しするためISR不可
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;

  const titles: Record<string, string> = {
    ja: 'リリースカレンダー | 新作AV発売日一覧',
    en: 'Release Calendar | New AV Release Dates',
    zh: '发行日历 | 新作AV发售日一览',
    'zh-TW': '發行日曆 | 新作AV發售日一覽',
    ko: '출시 캘린더 | 신작 AV 발매일 목록',
  };

  const descriptions: Record<string, string> = {
    ja: 'AV作品のリリースカレンダー。月別・日別の新作発売日を一覧で確認。発売予定の作品もチェックできます。',
    en: 'AV release calendar. Check new releases by month and day. View upcoming releases.',
    zh: 'AV作品发行日历。按月、按日查看新作发售日。还可以查看即将发售的作品。',
    'zh-TW': 'AV作品發行日曆。按月、按日查看新作發售日。還可以查看即將發售的作品。',
    ko: 'AV 작품 출시 캘린더. 월별, 일별 신작 발매일 확인. 출시 예정 작품도 확인 가능.',
  };

  return generateBaseMetadata(
    titles[locale] ?? titles['ja'] ?? '',
    descriptions[locale] ?? descriptions['ja'] ?? '',
    undefined,
    '/calendar',
    undefined,
    locale ?? 'ja',
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

  // カレンダー詳細データ、日別リリース数、フィルター用データを並列取得
  const [calendarData, dailyReleases, popularTags] = await Promise.all([
    getCalendarDetailData(targetYear, targetMonth, 4, 2),
    getDailyReleases(targetYear, targetMonth),
    getPopularTags({ limit: 50 }),
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
    'zh-TW': '發行日曆',
    ko: '출시 캘린더',
  };

  // タグをProductListFilter用に変換
  const genreTagsForFilter = popularTags.map((tag) => ({
    id: tag.id,
    name: tag.name,
    count: tag.count,
  }));

  return (
    <div className="theme-body min-h-screen">
      {/* 構造化データ */}
      <JsonLD data={structuredData} />

      <section id="calendar" className="scroll-mt-20 py-3 sm:py-4 md:py-6">
        <div className="container mx-auto px-3 sm:px-4">
          <Breadcrumb
            items={[
              { label: tNav('home'), href: localizedHref('/', locale) },
              { label: pageTitle[locale] ?? pageTitle['ja'] ?? '' },
            ]}
            className="mb-2 sm:mb-3"
          />

          <div className="mb-2 sm:mb-3">
            <h1 className="theme-text mb-0.5 text-xl font-bold sm:text-2xl md:text-3xl">
              {pageTitle[locale] ?? pageTitle['ja']}
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
    </div>
  );
}
