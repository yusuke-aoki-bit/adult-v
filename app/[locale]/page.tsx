import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import ActressCard from '@/components/ActressCard';
import SortDropdown from '@/components/SortDropdown';
import Pagination from '@/components/Pagination';
import ActressListFilter from '@/components/ActressListFilter';
import { getActresses, getActressesCount, getTags, getActressesWithNewReleases, getUncategorizedProductsCount, getAspStats, getSaleProducts, SaleProduct } from '@/lib/db/queries';
import { generateBaseMetadata } from '@/lib/seo';
import { Metadata } from 'next';
import type { Actress as ActressType } from '@/types/product';
import { providerMeta } from '@/lib/providers';
import { ASP_TO_PROVIDER_ID } from '@/lib/constants/filters';

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

  // hasVideo/hasImageフィルターを取得
  const hasVideo = searchParamsData.hasVideo === 'true';
  const hasImage = searchParamsData.hasImage === 'true';

  // タグ一覧を取得（全カテゴリ、siteカテゴリは除外）
  const allTags = await getTags();
  const genreTags = allTags.filter(tag => tag.category !== 'site');

  // ASP統計は常に取得（フィルター表示用）- 早い段階で取得してavailableAspsに使用
  let aspStats: Array<{ aspName: string; productCount: number; actressCount: number }> = [];
  try {
    aspStats = await getAspStats();
  } catch (error) {
    console.error('Failed to fetch ASP stats:', error);
  }

  // 利用可能なASP一覧（aspStatsから動的に生成、画面上部と一致させる）
  const availableAsps = aspStats.map(stat => ({
    id: stat.aspName,
    name: stat.aspName,
  }));

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
    hasVideo: hasVideo || undefined,
    hasImage: hasImage || undefined,
  });

  // 総数を効率的に取得
  const totalCount = await getActressesCount({
    query: searchQuery,
    includeTags,
    excludeTags,
    excludeInitials: isEtcFilter,
    includeAsps,
    excludeAsps,
    hasVideo: hasVideo || undefined,
    hasImage: hasImage || undefined,
  });

  // 新作リリース女優を取得（フィルターがない場合のみ）
  let newReleaseActresses: ActressType[] = [];
  let popularActresses: ActressType[] = [];
  let saleProducts: SaleProduct[] = [];
  let uncategorizedCount = 0;

  // TOPページのみ表示（検索、フィルター、ソート変更時は非表示）
  const isTopPage = !query && !initialFilter && includeTags.length === 0 && excludeTags.length === 0 && includeAsps.length === 0 && excludeAsps.length === 0 && !hasVideo && !hasImage && sortBy === 'recent' && page === 1;

  if (isTopPage) {
    try {
      const [newReleases, popular, sales, uncatCount] = await Promise.all([
        getActressesWithNewReleases({ limit: 50, daysAgo: 14 }),
        getActresses({ sortBy: 'productCountDesc', limit: 50 }),
        getSaleProducts({ limit: 20, minDiscount: 30 }),
        getUncategorizedProductsCount(),
      ]);
      newReleaseActresses = newReleases;
      popularActresses = popular;
      saleProducts = sales;
      uncategorizedCount = uncatCount;
    } catch (error) {
      console.error('Failed to fetch homepage sections:', error);
      // Gracefully degrade - just don't show these sections
    }
  }

  // ASP別商品数をマップに変換（フィルター表示用）
  const aspProductCounts: Record<string, number> = {};
  aspStats.forEach(stat => {
    aspProductCounts[stat.aspName] = stat.productCount;
  });

  return (
    <div className="bg-gray-900 min-h-screen">
      {/* ASP統計バッジ */}
      {isTopPage && aspStats.length > 0 && (
        <section className="py-6 border-b border-gray-800">
          <div className="container mx-auto px-4">
            <div className="flex flex-wrap justify-center gap-3">
              {aspStats.slice(0, 7).map((stat) => {
                const providerId = ASP_TO_PROVIDER_ID[stat.aspName];
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

      {/* セール情報セクション */}
      {saleProducts.length > 0 && (
        <details open className="border-b border-gray-800 bg-gradient-to-r from-red-950/30 to-gray-900">
          <summary className="py-2 md:py-3 cursor-pointer hover:bg-gray-800/30 transition-colors">
            <div className="container mx-auto px-4">
              <div className="flex items-center gap-2">
                <h2 className="text-base md:text-lg font-bold text-white flex items-center gap-2">
                  <span className="text-red-500">🔥</span>
                  {t('saleProducts') || 'セール中'}
                </h2>
                <span className="px-3 py-1 bg-red-600 text-white text-xs font-semibold rounded-full animate-pulse">
                  SALE
                </span>
                <span className="text-gray-400 text-sm ml-auto">({saleProducts.length})</span>
              </div>
            </div>
          </summary>
          <div className="container mx-auto px-4 pb-8">
            <div className="relative -mx-4 px-4">
              <div className="overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-800">
                <div className="flex gap-4 md:gap-6 min-w-max">
                  {saleProducts.map((product) => {
                    const providerId = ASP_TO_PROVIDER_ID[product.aspName];
                    const meta = providerId ? providerMeta[providerId] : null;
                    return (
                      <a
                        key={`${product.productId}-${product.aspName}`}
                        href={product.affiliateUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block shrink-0 w-44 md:w-52 bg-gray-800 rounded-lg overflow-hidden hover:ring-2 hover:ring-red-500/50 transition-all"
                      >
                        <div className="relative aspect-[3/4]">
                          {product.thumbnailUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={product.thumbnailUrl}
                              alt={product.title}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-700 flex items-center justify-center text-gray-500">
                              No Image
                            </div>
                          )}
                          {/* 割引バッジ */}
                          <div className="absolute top-2 left-2 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded">
                            {product.discountPercent}% OFF
                          </div>
                          {/* ASPバッジ */}
                          <div className={`absolute top-2 right-2 text-[10px] font-semibold px-2 py-0.5 rounded bg-gradient-to-r ${meta?.accentClass || 'from-gray-600 to-gray-500'}`}>
                            {meta?.label || product.aspName}
                          </div>
                          {/* セール終了時刻 */}
                          {product.endAt && (
                            <div className="absolute bottom-2 left-2 right-2 bg-black/70 text-white text-[10px] px-2 py-1 rounded text-center">
                              〜{new Date(product.endAt).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}まで
                            </div>
                          )}
                        </div>
                        <div className="p-3">
                          <h3 className="text-sm text-white font-medium line-clamp-2 mb-2">{product.title}</h3>
                          <div className="flex items-baseline gap-2">
                            <span className="text-red-500 font-bold text-lg">¥{product.salePrice.toLocaleString()}</span>
                            <span className="text-gray-500 text-sm line-through">¥{product.regularPrice.toLocaleString()}</span>
                          </div>
                          {product.performers.length > 0 && (
                            <div className="mt-2 text-xs text-gray-400 truncate">
                              {product.performers.map(p => p.name).join(', ')}
                            </div>
                          )}
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>
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

          {/* フィルター設定（頭文字検索 + タグフィルター） */}
          <ActressListFilter
            genreTags={genreTags}
            availableAsps={availableAsps}
            aspProductCounts={aspProductCounts}
            translations={{
              filterSettings: t('filterSettings'),
              initialSearch: t('initialSearch'),
              sampleContent: 'サンプルコンテンツ',
              sampleVideo: 'サンプル動画あり',
              sampleImage: 'サンプル画像あり',
              genre: tFilter('genre'),
              site: tFilter('site'),
              include: tFilter('include'),
              exclude: tFilter('exclude'),
              clear: tCommon('clear'),
            }}
          />

          {/* ページネーション（上部） */}
          <Pagination
            total={totalCount}
            page={page}
            perPage={ITEMS_PER_PAGE}
            basePath={`/${locale}`}
            position="top"
            queryParams={{
              ...(query ? { q: query } : {}),
              ...(initialFilter ? { initial: initialFilter } : {}),
              ...(sortBy !== 'nameAsc' ? { sort: sortBy } : {}),
              ...(includeTags.length > 0 ? { include: includeTags.join(',') } : {}),
              ...(excludeTags.length > 0 ? { exclude: excludeTags.join(',') } : {}),
              ...(includeAsps.length > 0 ? { includeAsp: includeAsps.join(',') } : {}),
              ...(excludeAsps.length > 0 ? { excludeAsp: excludeAsps.join(',') } : {}),
              ...(hasVideo ? { hasVideo: 'true' } : {}),
              ...(hasImage ? { hasImage: 'true' } : {}),
            }}
          />

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
            {actresses.map((actress) => (
              <Link key={actress.id} href={`/${locale}/actress/${actress.id}`} className="block">
                <ActressCard actress={actress} compact />
              </Link>
            ))}
          </div>

          {/* ページネーション（下部） */}
          <Pagination
            total={totalCount}
            page={page}
            perPage={ITEMS_PER_PAGE}
            basePath={`/${locale}`}
            position="bottom"
            queryParams={{
              ...(query ? { q: query } : {}),
              ...(initialFilter ? { initial: initialFilter } : {}),
              ...(sortBy !== 'nameAsc' ? { sort: sortBy } : {}),
              ...(includeTags.length > 0 ? { include: includeTags.join(',') } : {}),
              ...(excludeTags.length > 0 ? { exclude: excludeTags.join(',') } : {}),
              ...(includeAsps.length > 0 ? { includeAsp: includeAsps.join(',') } : {}),
              ...(excludeAsps.length > 0 ? { excludeAsp: excludeAsps.join(',') } : {}),
              ...(hasVideo ? { hasVideo: 'true' } : {}),
              ...(hasImage ? { hasImage: 'true' } : {}),
            }}
          />
        </div>
      </section>
    </div>
  );
}
