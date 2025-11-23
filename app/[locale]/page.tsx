import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import ActressCard from '@/components/ActressCard';
import SortDropdown from '@/components/SortDropdown';
import Pagination from '@/components/Pagination';
import InitialSearchMenu from '@/components/InitialSearchMenu';
import { getActresses, getActressesCount, getTags, getActressesWithNewReleases } from '@/lib/db/queries';
import { generateBaseMetadata } from '@/lib/seo';
import { Metadata } from 'next';
import type { Actress as ActressType } from '@/types/product';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'homepage' });

  return generateBaseMetadata(
    t('title'),
    t('description'),
    undefined,
    `/${locale}`,
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
  const sortBy = (typeof searchParamsData.sort === 'string' ? searchParamsData.sort : 'nameAsc') as 'nameAsc' | 'nameDesc' | 'productCountDesc' | 'productCountAsc' | 'recent';
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

  // タグ一覧を取得
  const genreTags = await getTags('genre');
  const siteTags = await getTags('site');

  const offset = (page - 1) * ITEMS_PER_PAGE;

  // "etc"の場合は特別処理（50音・アルファベット以外）
  let searchQuery = initialFilter || query;
  if (initialFilter === 'etc') {
    // "etc"の場合はクエリとして渡さず、後でフィルタリング
    searchQuery = undefined;
  }

  const actresses = await getActresses({
    limit: initialFilter === 'etc' ? 10000 : ITEMS_PER_PAGE, // etcの場合は全件取得してフィルタ
    offset: initialFilter === 'etc' ? 0 : offset,
    query: searchQuery,
    includeTags,
    excludeTags,
    sortBy
  });

  // "etc"の場合はフィルタリング
  let filteredActresses = actresses;
  let actualTotalCount = 0;
  if (initialFilter === 'etc') {
    // 50音・アルファベット以外で始まる名前をフィルタ
    const hiraganaPattern = /^[ぁ-ん]/; // 全ての平仮名（濁点・半濁点を含む）
    const katakanaPattern = /^[ァ-ヴー]/; // 全てのカタカナ（濁点・半濁点を含む）
    const alphabetPattern = /^[A-Za-z]/;

    filteredActresses = actresses.filter(actress => {
      const firstChar = actress.name.charAt(0);
      return !hiraganaPattern.test(firstChar) && !katakanaPattern.test(firstChar) && !alphabetPattern.test(firstChar);
    });

    actualTotalCount = filteredActresses.length;

    // ページネーション用に手動でスライス
    const start = offset;
    const end = offset + ITEMS_PER_PAGE;
    filteredActresses = filteredActresses.slice(start, end);
  }

  // 総数を効率的に取得
  const totalCount = initialFilter === 'etc' ? actualTotalCount : await getActressesCount({ query: initialFilter || query, includeTags, excludeTags });

  // 新作リリース女優を取得（フィルターがない場合のみ）
  let newReleaseActresses: ActressType[] = [];
  if (!query && !initialFilter && includeTags.length === 0 && excludeTags.length === 0 && page === 1) {
    try {
      newReleaseActresses = await getActressesWithNewReleases({ limit: 20, daysAgo: 30 });
    } catch (error) {
      console.error('Failed to fetch new release actresses:', error);
      // Gracefully degrade - just don't show the new releases section
      newReleaseActresses = [];
    }
  }

  return (
    <div className="bg-gray-900 min-h-screen">
      {/* 新作リリース女優 */}
      {newReleaseActresses.length > 0 && (
        <section className="py-8 md:py-12 border-b border-gray-800">
          <div className="container mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">
              {t('newReleases')}
            </h2>
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
        </section>
      )}

      {/* 女優一覧 */}
      <section className="py-12 md:py-16">
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
            <details className="mb-8 bg-gray-800 rounded-lg border border-gray-700">
              <summary className="px-4 py-3 cursor-pointer font-semibold text-white hover:bg-gray-750">
                {t('filterSettings')}
              </summary>
              <div className="px-4 pb-4 space-y-6">
                {query && <input type="hidden" name="q" value={query} />}
              {/* ジャンルタグ */}
              {genreTags.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-white mb-3">{tFilter('genre')}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* 対象フィルタ */}
                    <div>
                      <p className="text-xs text-gray-300 mb-2">{tFilter('include')}</p>
                      <div className="space-y-1 max-h-48 overflow-y-auto border border-gray-600 rounded p-2 bg-gray-750">
                        {genreTags.slice(0, 20).map((tag) => (
                          <label key={`include-genre-${tag.id}`} className="flex items-center gap-2 hover:bg-gray-700 p-1 rounded cursor-pointer">
                            <input
                              type="checkbox"
                              name="include"
                              value={tag.id}
                              defaultChecked={includeTags.includes(String(tag.id))}
                              className="rounded border-gray-500 text-rose-600 focus:ring-rose-500"
                            />
                            <span className="text-sm text-gray-200">{tag.name} ({tag.count})</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    {/* 除外フィルタ */}
                    <div>
                      <p className="text-xs text-gray-300 mb-2">{tFilter('exclude')}</p>
                      <div className="space-y-1 max-h-48 overflow-y-auto border border-gray-600 rounded p-2 bg-gray-750">
                        {genreTags.slice(0, 20).map((tag) => (
                          <label key={`exclude-genre-${tag.id}`} className="flex items-center gap-2 hover:bg-gray-700 p-1 rounded cursor-pointer">
                            <input
                              type="checkbox"
                              name="exclude"
                              value={tag.id}
                              defaultChecked={excludeTags.includes(String(tag.id))}
                              className="rounded border-gray-500 text-red-600 focus:ring-red-500"
                            />
                            <span className="text-sm text-gray-200">{tag.name} ({tag.count})</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* サイトタグ */}
              {siteTags.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-white mb-3">{tFilter('site')}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* 対象フィルタ */}
                    <div>
                      <p className="text-xs text-gray-300 mb-2">{tFilter('include')}</p>
                      <div className="space-y-1 border border-gray-600 rounded p-2 bg-gray-750">
                        {siteTags.map((tag) => (
                          <label key={`include-site-${tag.id}`} className="flex items-center gap-2 hover:bg-gray-700 p-1 rounded cursor-pointer">
                            <input
                              type="checkbox"
                              name="include"
                              value={tag.id}
                              defaultChecked={includeTags.includes(String(tag.id))}
                              className="rounded border-gray-500 text-rose-600 focus:ring-rose-500"
                            />
                            <span className="text-sm text-gray-200">{tag.name} ({tag.count})</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    {/* 除外フィルタ */}
                    <div>
                      <p className="text-xs text-gray-300 mb-2">{tFilter('exclude')}</p>
                      <div className="space-y-1 border border-gray-600 rounded p-2 bg-gray-750">
                        {siteTags.map((tag) => (
                          <label key={`exclude-site-${tag.id}`} className="flex items-center gap-2 hover:bg-gray-700 p-1 rounded cursor-pointer">
                            <input
                              type="checkbox"
                              name="exclude"
                              value={tag.id}
                              defaultChecked={excludeTags.includes(String(tag.id))}
                              className="rounded border-gray-500 text-red-600 focus:ring-red-500"
                            />
                            <span className="text-sm text-gray-200">{tag.name} ({tag.count})</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

                {/* フィルター適用ボタン */}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-rose-600 text-white rounded-md hover:bg-rose-700 transition-colors"
                  >
                    {tCommon('apply')}
                  </button>
                  <a
                    href={query ? `/${locale}?q=${query}` : `/${locale}`}
                    className="px-4 py-2 border border-gray-600 text-gray-200 rounded-md hover:bg-gray-700 transition-colors"
                  >
                    {tCommon('clear')}
                  </a>
                </div>
              </div>
            </details>
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
            {filteredActresses.map((actress) => (
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
            }}
          />
        </div>
      </section>
    </div>
  );
}
