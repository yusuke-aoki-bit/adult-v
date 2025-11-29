import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import ActressCard from '@/components/ActressCard';
import SortDropdown from '@/components/SortDropdown';
import Pagination from '@/components/Pagination';
import InitialSearchMenu from '@/components/InitialSearchMenu';
import { getActresses, getActressesCount, getTags, getActressesWithNewReleases, getPopularTags, getUncategorizedProductsCount, getMultiAspActresses, getAspStats } from '@/lib/db/queries';
import { generateBaseMetadata } from '@/lib/seo';
import { Metadata } from 'next';
import type { Actress as ActressType, ProviderId } from '@/types/product';
import { providerMeta } from '@/lib/providers';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'homepage' });

  // Use approximate count to avoid slow DB query in metadata generation
  // Actual count is displayed on the page itself
  const approximateCount = '38,000';

  return generateBaseMetadata(
    t('title'),
    t('description', { count: approximateCount }),
    undefined,
    `/${locale}`,
    undefined,
    locale,
  );
}

// 動的生成（DBから毎回取得）
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: { [key: string]: string | string[] | undefined };
}

const ITEMS_PER_PAGE = 50;

export default async function Home({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'homepage' });
  const tCommon = await getTranslations({ locale, namespace: 'common' });
  const tFilter = await getTranslations({ locale, namespace: 'filter' });
  const tSort = await getTranslations({ locale, namespace: 'sort' });

  const searchParamsData = await searchParams;
  const page = Number(searchParamsData.page) || 1;
  const query = typeof searchParamsData.q === 'string' ? searchParamsData.q : undefined;
  const sortBy = (typeof searchParamsData.sort === 'string' ? searchParamsData.sort : 'recent') as 'nameAsc' | 'nameDesc' | 'productCountDesc' | 'productCountAsc' | 'recent';
  const initialFilter = typeof searchParamsData.initial === 'string' ? searchParamsData.initial : undefined;

  // 対象タグ（include）と除外タグ（exclude）を取得
  const includeTags = typeof searchParamsData.include === 'string'
    ? searchParamsData.include.split(',').filter(Boolean)
    : Array.isArray(searchParamsData.include)
    ? searchParamsData.include
    : [];
  const excludeTags = typeof searchParamsData.exclude === 'string'
    ? searchParamsData.exclude.split(',').filter(Boolean)
    : Array.isArray(searchParamsData.exclude)
    ? searchParamsData.exclude
    : [];

  // ASPフィルターを取得
  const includeAsps = typeof searchParamsData.includeAsp === 'string'
    ? searchParamsData.includeAsp.split(',').filter(Boolean)
    : Array.isArray(searchParamsData.includeAsp)
    ? searchParamsData.includeAsp
    : [];
  const excludeAsps = typeof searchParamsData.excludeAsp === 'string'
    ? searchParamsData.excludeAsp.split(',').filter(Boolean)
    : Array.isArray(searchParamsData.excludeAsp)
    ? searchParamsData.excludeAsp
    : [];

  // タグ一覧を取得
  const genreTags = await getTags('genre');
  const siteTags = await getTags('site');

  // 利用可能なASP一覧（フィルター用）
  const availableAsps = [
    { id: 'DUGA', name: 'DUGA' },
    { id: 'DTI', name: 'DTI' },
    { id: 'Sokmil', name: 'Sokmil' },
    { id: 'MGS', name: 'MGS' },
    { id: 'b10f', name: 'b10f' },
    { id: 'FC2', name: 'FC2' },
    { id: 'Japanska', name: 'Japanska' },
  ];

  const offset = (page - 1) * ITEMS_PER_PAGE;

  // "etc"の場合は特別処理（50音・アルファベット以外）
  const isEtcFilter = initialFilter === 'etc';
  let searchQuery = initialFilter || query;
  if (isEtcFilter) {
    // "etc"の場合はクエリとして渡さない
    searchQuery = undefined;
  }

  const actresses = await getActresses({
    limit: ITEMS_PER_PAGE,
    offset,
    query: searchQuery,
    includeTags,
    excludeTags,
    sortBy,
    excludeInitials: isEtcFilter, // データベース側で'etc'フィルタリング
    includeAsps,
    excludeAsps,
  });

  // 総数を効率的に取得
  const totalCount = await getActressesCount({
    query: searchQuery,
    includeTags,
    excludeTags,
    excludeInitials: isEtcFilter,
    includeAsps,
    excludeAsps,
  });

  // ASP統計は常に取得（フィルター表示用）
  let aspStats: Array<{ aspName: string; productCount: number; actressCount: number }> = [];
  try {
    aspStats = await getAspStats();
  } catch (error) {
    console.error('Failed to fetch ASP stats:', error);
  }

  // 新作リリース女優を取得（フィルターがない場合のみ）
  let newReleaseActresses: ActressType[] = [];
  let popularActresses: ActressType[] = [];
  let multiAspActresses: ActressType[] = [];
  let popularGenreTags: Array<{ id: number; name: string; category: string | null; count: number }> = [];
  let uncategorizedCount = 0;

  if (!query && !initialFilter && includeTags.length === 0 && excludeTags.length === 0 && page === 1) {
    try {
      const [newReleases, popular, multiAsp, popTags, uncatCount] = await Promise.all([
        getActressesWithNewReleases({ limit: 40, daysAgo: 14 }),
        getActresses({ sortBy: 'productCountDesc', limit: 15 }),
        getMultiAspActresses({ limit: 20, minAspCount: 2 }),
        getPopularTags({ category: 'genre', limit: 30 }),
        getUncategorizedProductsCount(),
      ]);
      newReleaseActresses = newReleases;
      popularActresses = popular;
      multiAspActresses = multiAsp;
      popularGenreTags = popTags;
      uncategorizedCount = uncatCount;
    } catch (error) {
      console.error('Failed to fetch homepage sections:', error);
      // Gracefully degrade - just don't show these sections
    }
  }

  // ASP名からProviderIdへのマッピング
  const aspToProviderId: Record<string, ProviderId> = {
    'DUGA': 'duga', 'duga': 'duga',
    'DTI': 'dti', 'dti': 'dti',
    'Sokmil': 'sokmil', 'sokmil': 'sokmil',
    'MGS': 'mgs', 'mgs': 'mgs',
    'b10f': 'b10f', 'B10F': 'b10f',
    'FC2': 'fc2', 'fc2': 'fc2',
    'Japanska': 'japanska', 'japanska': 'japanska',
  };

  // ASP別商品数をマップに変換（フィルター表示用）
  const aspProductCounts: Record<string, number> = {};
  aspStats.forEach(stat => {
    aspProductCounts[stat.aspName] = stat.productCount;
  });

  return (
    <div className="bg-gray-900 min-h-screen">
      {/* ASP統計バッジ */}
      {page === 1 && !query && !initialFilter && includeTags.length === 0 && excludeTags.length === 0 && aspStats.length > 0 && (
        <section className="py-6 border-b border-gray-800">
          <div className="container mx-auto px-4">
            <div className="flex flex-wrap justify-center gap-3">
              {aspStats.slice(0, 7).map((stat) => {
                const providerId = aspToProviderId[stat.aspName];
                const meta = providerId ? providerMeta[providerId] : null;
                return (
                  <div
                    key={stat.aspName}
                    className={`px-4 py-2 rounded-lg bg-gradient-to-r ${meta?.accentClass || 'from-gray-600 to-gray-500'} text-white text-sm font-medium`}
                  >
                    <span className="font-bold">{meta?.label || stat.aspName}</span>
                    <span className="ml-2 opacity-90">{stat.productCount.toLocaleString()}作品</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* マルチサイト女優 - コンセプトの中心 */}
      {multiAspActresses.length > 0 && (
        <details className="border-b border-gray-800 bg-gradient-to-r from-rose-950/20 to-gray-900">
          <summary className="py-2 md:py-3 cursor-pointer hover:bg-gray-800/30 transition-colors">
            <div className="container mx-auto px-4">
              <div className="flex items-center gap-2">
                <h2 className="text-base md:text-lg font-bold text-white">
                  {t('multiAspActresses') || '複数サイトで活躍中'}
                </h2>
                <span className="px-3 py-1 bg-rose-600 text-white text-xs font-semibold rounded-full">
                  {t('recommended') || 'おすすめ'}
                </span>
                <span className="text-gray-400 text-sm ml-auto">({multiAspActresses.length})</span>
              </div>
            </div>
          </summary>
          <div className="container mx-auto px-4 pb-8">
            <p className="text-gray-400 mb-6">
              {t('multiAspDescription') || '複数のサイトで作品が配信されている女優です。サイトを比較してお得に購入できます。'}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
              {multiAspActresses.slice(0, 10).map((actress) => (
                <Link
                  key={actress.id}
                  href={`/${locale}/actress/${actress.id}`}
                  className="block"
                >
                  <ActressCard actress={actress} compact />
                </Link>
              ))}
            </div>
          </div>
        </details>
      )}

      {/* 新作リリース女優 */}
      {newReleaseActresses.length > 0 && (
        <details className="border-b border-gray-800">
          <summary className="py-2 md:py-3 cursor-pointer hover:bg-gray-800/30 transition-colors">
            <div className="container mx-auto px-4">
              <div className="flex items-center gap-2">
                <h2 className="text-base md:text-lg font-bold text-white">
                  {t('newReleases')}
                </h2>
                <span className="text-gray-400 text-sm ml-auto">({newReleaseActresses.length})</span>
              </div>
            </div>
          </summary>
          <div className="container mx-auto px-4 pb-8">
            <div className="relative -mx-4 px-4">
              <div className="overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-800">
                <div className="flex gap-4 md:gap-6 min-w-max">
                  {newReleaseActresses.map((actress) => (
                    <Link
                      key={actress.id}
                      href={`/${locale}/actress/${actress.id}`}
                      className="block shrink-0 w-40 md:w-48"
                    >
                      <ActressCard actress={actress} compact />
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </details>
      )}

      {/* 人気女優 */}
      {popularActresses.length > 0 && (
        <details className="border-b border-gray-800">
          <summary className="py-2 md:py-3 cursor-pointer hover:bg-gray-800/30 transition-colors">
            <div className="container mx-auto px-4">
              <div className="flex items-center gap-2">
                <h2 className="text-base md:text-lg font-bold text-white">
                  {t('popularActresses')}
                </h2>
                <span className="text-gray-400 text-sm ml-auto">({popularActresses.length})</span>
              </div>
            </div>
          </summary>
          <div className="container mx-auto px-4 pb-8">
            <div className="relative -mx-4 px-4">
              <div className="overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-800">
                <div className="flex gap-4 md:gap-6 min-w-max">
                  {popularActresses.map((actress) => (
                    <Link
                      key={actress.id}
                      href={`/${locale}/actress/${actress.id}`}
                      className="block shrink-0 w-40 md:w-48"
                    >
                      <ActressCard actress={actress} compact />
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </details>
      )}

      {/* タグ */}
      {popularGenreTags.length > 0 && (
        <details className="border-b border-gray-800">
          <summary className="py-2 md:py-3 cursor-pointer hover:bg-gray-800/30 transition-colors">
            <div className="container mx-auto px-4">
              <div className="flex items-center gap-2">
                <h2 className="text-base md:text-lg font-bold text-white">
                  タグ
                </h2>
                <span className="text-gray-400 text-sm ml-auto">({popularGenreTags.length})</span>
              </div>
            </div>
          </summary>
          <div className="container mx-auto px-4 pb-8">
            <div className="flex flex-wrap gap-2">
              {popularGenreTags.map((tag) => (
                <Link
                  key={tag.id}
                  href={`/${locale}?include=${tag.id}`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-full text-sm font-medium transition-colors border border-gray-700 hover:border-rose-600"
                >
                  <span>{tag.name}</span>
                  <span className="text-xs text-gray-400">({tag.count})</span>
                </Link>
              ))}
            </div>
          </div>
        </details>
      )}

      {/* 未整理作品へのリンク */}
      {uncategorizedCount > 0 && (
        <section className="py-6 border-b border-gray-800">
          <div className="container mx-auto px-4">
            <Link
              href={`/${locale}/uncategorized`}
              className="flex items-center justify-between p-4 bg-gray-800 hover:bg-gray-750 rounded-lg border border-gray-700 hover:border-yellow-600 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-yellow-600 text-white text-sm font-semibold rounded-full">
                  未整理
                </span>
                <div>
                  <span className="text-white font-medium">出演者情報が未整理の作品</span>
                  <span className="text-gray-400 ml-2">({uncategorizedCount.toLocaleString()}件)</span>
                </div>
              </div>
              <svg className="w-5 h-5 text-gray-400 group-hover:text-yellow-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </section>
      )}

      {/* 女優一覧 */}
      <section id="list" className="py-12 md:py-16 scroll-mt-4">
        <div className="container mx-auto px-4">
          <div className="mb-8">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
                  {tCommon('actresses')}
                </h1>
                <p className="text-gray-300">
                  {t('actressCount', { count: totalCount })}
                </p>
              </div>

              {/* ソート選択 */}
              <SortDropdown sortBy={sortBy} />
            </div>
          </div>

          {/* 50音・アルファベット頭文字フィルター */}
          <div className="mb-6">
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
              <h3 className="text-sm font-semibold text-white mb-3">{t('initialSearch')}</h3>
              <InitialSearchMenu
                locale={locale}
                initialFilter={initialFilter ?? null}
                sortBy={sortBy}
                includeTags={includeTags.map(Number)}
                excludeTags={excludeTags.map(Number)}
              />
              {initialFilter && (
                <div className="mt-3">
                  <Link
                    href={`/${locale}${query ? `?q=${query}` : ''}${sortBy !== 'nameAsc' ? `${query ? '&' : '?'}sort=${sortBy}` : ''}${includeTags.length > 0 ? `${query || sortBy !== 'nameAsc' ? '&' : '?'}include=${includeTags.join(',')}` : ''}${excludeTags.length > 0 ? `${query || sortBy !== 'nameAsc' || includeTags.length > 0 ? '&' : '?'}exclude=${excludeTags.join(',')}` : ''}`}
                    className="px-3 py-1.5 rounded text-sm font-medium bg-gray-700 text-gray-200 hover:bg-gray-600 transition-colors inline-block"
                  >
                    {tCommon('clear')}
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* タグフィルター */}
          <form method="get" action={`/${locale}`}>
            <details className="mb-6 sm:mb-8 bg-gray-800 rounded-lg border border-gray-700">
              <summary className="px-3 sm:px-4 py-3 cursor-pointer font-semibold text-white hover:bg-gray-750 flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                {t('filterSettings')}
              </summary>
              <div className="px-3 sm:px-4 pb-4 space-y-4 sm:space-y-6">
                {query && <input type="hidden" name="q" value={query} />}
              {/* ジャンルタグ */}
              {genreTags.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-white mb-2 sm:mb-3">{tFilter('genre')}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    {/* 対象フィルタ */}
                    <div>
                      <p className="text-xs text-gray-300 mb-2">{tFilter('include')}</p>
                      <div className="space-y-0.5 max-h-40 sm:max-h-48 overflow-y-auto border border-gray-600 rounded p-2 bg-gray-750">
                        {genreTags.slice(0, 20).map((tag) => (
                          <label key={`include-genre-${tag.id}`} className="flex items-center gap-2 sm:gap-3 hover:bg-gray-700 active:bg-gray-600 p-2 sm:p-1.5 rounded cursor-pointer min-h-[44px] sm:min-h-0">
                            <input
                              type="checkbox"
                              name="include"
                              value={tag.id}
                              defaultChecked={includeTags.includes(String(tag.id))}
                              className="w-5 h-5 sm:w-4 sm:h-4 rounded border-gray-500 text-rose-600 focus:ring-rose-500"
                            />
                            <span className="text-sm text-gray-200">{tag.name} <span className="text-gray-400">({tag.count})</span></span>
                          </label>
                        ))}
                      </div>
                    </div>
                    {/* 除外フィルタ */}
                    <div>
                      <p className="text-xs text-gray-300 mb-2">{tFilter('exclude')}</p>
                      <div className="space-y-0.5 max-h-40 sm:max-h-48 overflow-y-auto border border-gray-600 rounded p-2 bg-gray-750">
                        {genreTags.slice(0, 20).map((tag) => (
                          <label key={`exclude-genre-${tag.id}`} className="flex items-center gap-2 sm:gap-3 hover:bg-gray-700 active:bg-gray-600 p-2 sm:p-1.5 rounded cursor-pointer min-h-[44px] sm:min-h-0">
                            <input
                              type="checkbox"
                              name="exclude"
                              value={tag.id}
                              defaultChecked={excludeTags.includes(String(tag.id))}
                              className="w-5 h-5 sm:w-4 sm:h-4 rounded border-gray-500 text-red-600 focus:ring-red-500"
                            />
                            <span className="text-sm text-gray-200">{tag.name} <span className="text-gray-400">({tag.count})</span></span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 配信サイト（ASP）フィルター */}
              <div>
                <h3 className="text-sm font-semibold text-white mb-2 sm:mb-3">{tFilter('site')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  {/* 対象フィルタ */}
                  <div>
                    <p className="text-xs text-gray-300 mb-2">{tFilter('include')}</p>
                    <div className="flex flex-wrap gap-2 sm:space-y-0.5 sm:block border border-gray-600 rounded p-2 bg-gray-750">
                      {availableAsps.map((asp) => {
                        const providerId = aspToProviderId[asp.id];
                        const meta = providerId ? providerMeta[providerId] : null;
                        const count = aspProductCounts[asp.id];
                        return (
                          <label key={`include-asp-${asp.id}`} className="flex items-center gap-2 hover:bg-gray-700 active:bg-gray-600 p-2 sm:p-1.5 rounded cursor-pointer min-h-[44px] sm:min-h-0">
                            <input
                              type="checkbox"
                              name="includeAsp"
                              value={asp.id}
                              defaultChecked={includeAsps.includes(asp.id)}
                              className="w-5 h-5 sm:w-4 sm:h-4 rounded border-gray-500 text-rose-600 focus:ring-rose-500"
                            />
                            <span className={`text-sm font-medium px-2 py-0.5 rounded ${meta?.accentClass || 'bg-gray-600'} text-white`}>
                              {meta?.label || asp.name}
                              {count !== undefined && <span className="ml-1 text-xs opacity-80">({count.toLocaleString()})</span>}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  {/* 除外フィルタ */}
                  <div>
                    <p className="text-xs text-gray-300 mb-2">{tFilter('exclude')}</p>
                    <div className="flex flex-wrap gap-2 sm:space-y-0.5 sm:block border border-gray-600 rounded p-2 bg-gray-750">
                      {availableAsps.map((asp) => {
                        const providerId = aspToProviderId[asp.id];
                        const meta = providerId ? providerMeta[providerId] : null;
                        const count = aspProductCounts[asp.id];
                        return (
                          <label key={`exclude-asp-${asp.id}`} className="flex items-center gap-2 hover:bg-gray-700 active:bg-gray-600 p-2 sm:p-1.5 rounded cursor-pointer min-h-[44px] sm:min-h-0">
                            <input
                              type="checkbox"
                              name="excludeAsp"
                              value={asp.id}
                              defaultChecked={excludeAsps.includes(asp.id)}
                              className="w-5 h-5 sm:w-4 sm:h-4 rounded border-gray-500 text-red-600 focus:ring-red-500"
                            />
                            <span className={`text-sm font-medium px-2 py-0.5 rounded ${meta?.accentClass || 'bg-gray-600'} text-white`}>
                              {meta?.label || asp.name}
                              {count !== undefined && <span className="ml-1 text-xs opacity-80">({count.toLocaleString()})</span>}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

                {/* フィルター適用ボタン */}
                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 sm:flex-none px-6 py-3 sm:py-2 bg-rose-600 text-white rounded-lg sm:rounded-md font-medium hover:bg-rose-700 active:bg-rose-800 transition-colors"
                  >
                    {tCommon('apply')}
                  </button>
                  <a
                    href={query ? `/${locale}?q=${query}` : `/${locale}`}
                    className="flex-1 sm:flex-none text-center px-6 py-3 sm:py-2 border border-gray-600 text-gray-200 rounded-lg sm:rounded-md font-medium hover:bg-gray-700 active:bg-gray-600 transition-colors"
                  >
                    {tCommon('clear')}
                  </a>
                </div>
              </div>
            </details>
          </form>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
            {actresses.map((actress) => (
              <Link key={actress.id} href={`/${locale}/actress/${actress.id}`} className="block">
                <ActressCard actress={actress} compact />
              </Link>
            ))}
          </div>

          {/* ページネーション */}
          <Pagination
            total={totalCount}
            page={page}
            perPage={ITEMS_PER_PAGE}
            basePath={`/${locale}`}
            queryParams={{
              ...(query ? { q: query } : {}),
              ...(initialFilter ? { initial: initialFilter } : {}),
              ...(sortBy !== 'nameAsc' ? { sort: sortBy } : {}),
              ...(includeTags.length > 0 ? { include: includeTags.join(',') } : {}),
              ...(excludeTags.length > 0 ? { exclude: excludeTags.join(',') } : {}),
              ...(includeAsps.length > 0 ? { includeAsp: includeAsps.join(',') } : {}),
              ...(excludeAsps.length > 0 ? { excludeAsp: excludeAsps.join(',') } : {}),
            }}
          />
        </div>
      </section>
    </div>
  );
}
