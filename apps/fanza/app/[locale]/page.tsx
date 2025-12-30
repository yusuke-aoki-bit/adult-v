import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import ActressCard from '@/components/ActressCard';
import SortDropdown from '@/components/SortDropdown';
import { Pagination } from '@adult-v/shared/components';
import ActressListFilter from '@/components/ActressListFilter';
import RecentlyViewed from '@/components/RecentlyViewed';
import ForYouRecommendations from '@/components/ForYouRecommendations';
import SalesSection from '@/components/SalesSection';
import WeeklyHighlights from '@/components/WeeklyHighlights';
import { getActresses, getActressesCount, getTags, getUncategorizedProductsCount, getAspStats, getSaleProducts, SaleProduct } from '@/lib/db/queries';
import { generateBaseMetadata, generateFAQSchema, getHomepageFAQs } from '@/lib/seo';
import { JsonLD } from '@/components/JsonLD';
import { Metadata } from 'next';
import { getServerAspFilter, isServerFanzaSite } from '@/lib/server/site-mode';
import { localizedHref } from '@adult-v/shared/i18n';

// LCP最適化用のシンプルな画像URL正規化
function normalizeImageUrlForPreload(url: string | null | undefined): string | null {
  if (!url || url.trim() === '') return null;
  // Protocol-relative URLを絶対URLに変換
  if (url.startsWith('//')) return `https:${url}`;
  return url;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const searchParamsData = await searchParams;
  const t = await getTranslations({ locale, namespace: 'homepage' });

  // Use approximate count to avoid slow DB query in metadata generation
  // Actual count is displayed on the page itself
  const approximateCount = '38,000';

  // 検索クエリやフィルターがある場合はnoindex
  const hasQuery = !!searchParamsData.q;
  const hasFilters = !!(
    searchParamsData.initial ||
    searchParamsData.include ||
    searchParamsData.exclude ||
    searchParamsData.includeAsp ||
    searchParamsData.excludeAsp ||
    searchParamsData.hasVideo ||
    searchParamsData.hasImage ||
    searchParamsData.hasReview
  );
  const hasPageParam = !!searchParamsData.page && searchParamsData.page !== '1';
  // sortパラメータがデフォルト以外の場合もnoindex（重複コンテンツ防止）
  const hasNonDefaultSort = !!searchParamsData.sort && searchParamsData.sort !== 'releaseCount';

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';

  const metadata = generateBaseMetadata(
    t('title'),
    t('description', { count: approximateCount }),
    undefined,
    `/${locale}`,
    undefined,
    locale,
  );

  // hreflang/canonical設定
  const alternates = {
    canonical: `${baseUrl}/`,
    languages: {
      'ja': `${baseUrl}/`,
      'en': `${baseUrl}/?hl=en`,
      'zh': `${baseUrl}/?hl=zh`,
      'zh-TW': `${baseUrl}/?hl=zh-TW`,
      'ko': `${baseUrl}/?hl=ko`,
      'x-default': `${baseUrl}/`,
    },
  };

  // 検索・フィルター・2ページ目以降・非デフォルトソートはnoindex（重複コンテンツ防止）
  if (hasQuery || hasFilters || hasPageParam || hasNonDefaultSort) {
    return {
      ...metadata,
      alternates,
      robots: {
        index: false,
        follow: true,
      },
    };
  }

  return { ...metadata, alternates };
}

// ISR: 60秒ごとに再検証（searchParamsがあるため完全な静的生成は不可）
// 注: searchParamsを使用しているため、実際のキャッシュはNext.jsの判断による
export const revalidate = 60;

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const PER_PAGE = 96;

export default async function Home({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'homepage' });
  const tCommon = await getTranslations({ locale, namespace: 'common' });
  const tFilter = await getTranslations({ locale, namespace: 'filter' });
  const tUncategorized = await getTranslations({ locale, namespace: 'uncategorized' });

  const searchParamsData = await searchParams;
  const page = Number(searchParamsData.page) || 1;

  // FANZAサイトかどうかを判定
  const [serverAspFilter, isFanzaSite] = await Promise.all([
    getServerAspFilter(),
    isServerFanzaSite(),
  ]);


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

  // ASPフィルターを取得（FANZAサイトの場合は自動的にFANZAのみをフィルタ）
  const includeAsps = serverAspFilter
    ? serverAspFilter
    : (typeof searchParamsData.includeAsp === 'string'
        ? searchParamsData.includeAsp.split(',').filter(Boolean)
        : Array.isArray(searchParamsData.includeAsp)
        ? searchParamsData.includeAsp
        : []);
  const excludeAsps = typeof searchParamsData.excludeAsp === 'string'
    ? searchParamsData.excludeAsp.split(',').filter(Boolean)
    : Array.isArray(searchParamsData.excludeAsp)
    ? searchParamsData.excludeAsp
    : [];

  // hasVideo/hasImage/hasReviewフィルターを取得
  const hasVideo = searchParamsData.hasVideo === 'true';
  const hasImage = searchParamsData.hasImage === 'true';
  const hasReview = searchParamsData.hasReview === 'true';

  // 女優特徴フィルターを取得
  const cupSizes = typeof searchParamsData.cup === 'string'
    ? searchParamsData.cup.split(',').filter(Boolean)
    : [];
  const heightMin = typeof searchParamsData.heightMin === 'string' && searchParamsData.heightMin
    ? parseInt(searchParamsData.heightMin)
    : undefined;
  const heightMax = typeof searchParamsData.heightMax === 'string' && searchParamsData.heightMax
    ? parseInt(searchParamsData.heightMax)
    : undefined;
  const bloodTypes = typeof searchParamsData.bloodType === 'string'
    ? searchParamsData.bloodType.split(',').filter(Boolean)
    : [];

  const offset = (page - 1) * PER_PAGE;

  // "etc"の場合は特別処理（50音・アルファベット以外）
  const isEtcFilter = initialFilter === 'etc';
  let searchQuery = initialFilter || query;
  if (isEtcFilter) {
    // "etc"の場合はクエリとして渡さない
    searchQuery = undefined;
  }

  // 共通のクエリオプション
  const actressQueryOptions = {
    query: searchQuery,
    includeTags,
    excludeTags,
    sortBy,
    excludeInitials: isEtcFilter,
    includeAsps,
    excludeAsps,
    hasVideo: hasVideo || undefined,
    hasImage: hasImage || undefined,
    hasReview: hasReview || undefined,
    cupSizes: cupSizes.length > 0 ? cupSizes : undefined,
    heightMin,
    heightMax,
    bloodTypes: bloodTypes.length > 0 ? bloodTypes : undefined,
  };

  // 並列クエリ実行（パフォーマンス最適化）
  // タグ、ASP統計、女優リスト、女優数を同時に取得
  const [allTags, aspStatsResult, actresses, totalCount] = await Promise.all([
    getTags(),
    !isFanzaSite ? getAspStats().catch((error: unknown) => {
      console.error('Failed to fetch ASP stats:', error);
      return [] as Array<{ aspName: string; productCount: number; actressCount: number }>;
    }) : Promise.resolve([] as Array<{ aspName: string; productCount: number; actressCount: number }>),
    getActresses({
      ...actressQueryOptions,
      limit: PER_PAGE,
      offset,
      locale,
    }),
    getActressesCount(actressQueryOptions),
  ]);

  const genreTags = allTags.filter(tag => tag.category !== 'site');
  const aspStats = aspStatsResult;

  // 利用可能なASP一覧（aspStatsから動的に生成、画面上部と一致させる）
  const availableAsps = aspStats.map(stat => ({
    id: stat.aspName,
    name: stat.aspName,
  }));

  // セール情報を取得（フィルターがない場合のみ）
  let saleProducts: SaleProduct[] = [];
  let uncategorizedCount = 0;

  // TOPページのみ表示（検索、フィルター、ソート変更時は非表示）
  // FANZAサイトではincludeAspsが自動的に['FANZA']になるため、ASPフィルターはTOPページ判定に含めない
  const userSetIncludeAsps = isFanzaSite ? [] : includeAsps;
  const userSetExcludeAsps = isFanzaSite ? [] : excludeAsps;
  const isTopPage = !query && !initialFilter && includeTags.length === 0 && excludeTags.length === 0 && userSetIncludeAsps.length === 0 && userSetExcludeAsps.length === 0 && !hasVideo && !hasImage && !hasReview && cupSizes.length === 0 && heightMin === undefined && heightMax === undefined && bloodTypes.length === 0 && sortBy === 'recent' && page === 1;

  if (isTopPage) {
    try {
      const [sales, uncatCount] = await Promise.all([
        getSaleProducts({
          limit: 24, // トップページは24件表示
          minDiscount: 30,
          aspName: isFanzaSite ? 'FANZA' : undefined, // FANZAサイトの場合はFANZAのみ
        }),
        getUncategorizedProductsCount({
          includeAsp: isFanzaSite ? ['FANZA'] : undefined,
        }),
      ]);
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

  // FAQスキーマ（トップページのみ）
  const faqSchema = isTopPage ? generateFAQSchema(getHomepageFAQs(locale)) : null;

  // LCP最適化: 最初の女優画像をpreload（コンパクトモードではthumbnail優先）
  const firstActressImageUrl = actresses.length > 0
    ? normalizeImageUrlForPreload(actresses[0].thumbnail || actresses[0].heroImage)
    : null;

  return (
    <div className="theme-body min-h-screen">
      {/* LCP最適化: 最初の画像をpreload */}
      {firstActressImageUrl && (
        <link
          rel="preload"
          as="image"
          href={firstActressImageUrl}
          fetchPriority="high"
        />
      )}
      {/* FAQスキーマ（トップページのみ） */}
      {faqSchema && <JsonLD data={faqSchema} />}
      {/* セール情報セクション */}
      {saleProducts.length > 0 && (
        <section className="py-3 sm:py-4">
          <div className="container mx-auto px-3 sm:px-4">
            <SalesSection saleProducts={saleProducts.map(p => ({
              ...p,
              endAt: p.endAt ? p.endAt.toISOString() : null,
            }))} locale={locale} defaultOpen={true} />
          </div>
        </section>
      )}

      {/* 最近見た作品 */}
      <RecentlyViewed locale={locale} />

      {/* あなたへのおすすめ（閲覧履歴に基づく） */}
      <ForYouRecommendations locale={locale} />

      {/* 今週の注目（自動キュレーション） */}
      <WeeklyHighlights locale={locale} />

      {/* 未整理作品へのリンク */}
      {uncategorizedCount > 0 && (
        <section className="py-3 sm:py-6">
          <div className="container mx-auto px-3 sm:px-4">
            <Link
              href={localizedHref('/products?uncategorized=true', locale)}
              className="flex items-center justify-between p-3 sm:p-4 theme-content hover:opacity-90 rounded-lg border theme-border hover:border-yellow-600 transition-colors group gap-2"
            >
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <span className="px-2 sm:px-3 py-1 bg-yellow-600 text-white text-xs sm:text-sm font-semibold rounded-full whitespace-nowrap shrink-0">
                  {tUncategorized('badge')}
                </span>
                <div className="min-w-0">
                  <span className="theme-text font-medium text-sm sm:text-base">{tUncategorized('shortDescription')}</span>
                  <span className="theme-text-muted ml-1 sm:ml-2 text-xs sm:text-sm">({tUncategorized('itemCount', { count: uncategorizedCount.toLocaleString() })})</span>
                </div>
              </div>
              <svg className="w-5 h-5 theme-text-muted group-hover:text-yellow-600 transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </section>
      )}

      {/* 女優一覧 */}
      <section id="list" className="py-3 sm:py-4 md:py-6 scroll-mt-4">
        <div className="container mx-auto px-3 sm:px-4">
          <div className="mb-2 sm:mb-3">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold theme-text mb-0.5">
              {tCommon('actresses')}
            </h1>
            <p className="text-sm sm:text-base theme-text-secondary">
              {t('actressCount', { count: totalCount })}
            </p>
          </div>

          {/* フィルター設定（頭文字検索 + タグフィルター） */}
          <ActressListFilter
            genreTags={genreTags}
            availableAsps={availableAsps}
            aspProductCounts={aspProductCounts}
            isFanzaSite={isFanzaSite}
            translations={{
              filterSettings: tFilter('filterSettings'),
              initialSearch: tFilter('initialSearch'),
              sampleContent: tFilter('sampleContent'),
              sampleVideo: tFilter('sampleVideo'),
              sampleImage: tFilter('sampleImage'),
              genre: tFilter('genre'),
              site: tFilter('site'),
              include: tFilter('include'),
              exclude: tFilter('exclude'),
              clear: tFilter('clear'),
              loading: tFilter('loading'),
              other: tFilter('other'),
              saleFilter: tFilter('saleFilter'),
              onSaleOnly: tFilter('onSaleOnly'),
              reviewFilter: tFilter('reviewFilter'),
              hasReviewOnly: tFilter('hasReviewOnly'),
            }}
          />

          {/* 並び順 */}
          <div className="flex justify-end mb-2 sm:mb-4">
            <SortDropdown sortBy={sortBy} />
          </div>

          {/* ページネーション（上部） */}
          <Pagination
            total={totalCount}
            page={page}
            perPage={PER_PAGE}
            basePath={localizedHref('/', locale)}
            position="top"
            queryParams={{
              ...(query ? { q: query } : {}),
              ...(initialFilter ? { initial: initialFilter } : {}),
              ...(sortBy !== 'recent' ? { sort: sortBy } : {}),
              ...(includeTags.length > 0 ? { include: includeTags.join(',') } : {}),
              ...(excludeTags.length > 0 ? { exclude: excludeTags.join(',') } : {}),
              ...(!isFanzaSite && includeAsps.length > 0 ? { includeAsp: includeAsps.join(',') } : {}),
              ...(!isFanzaSite && excludeAsps.length > 0 ? { excludeAsp: excludeAsps.join(',') } : {}),
              ...(hasVideo ? { hasVideo: 'true' } : {}),
              ...(hasImage ? { hasImage: 'true' } : {}),
              ...(hasReview ? { hasReview: 'true' } : {}),
              ...(cupSizes.length > 0 ? { cup: cupSizes.join(',') } : {}),
              ...(heightMin !== undefined ? { heightMin: String(heightMin) } : {}),
              ...(heightMax !== undefined ? { heightMax: String(heightMax) } : {}),
              ...(bloodTypes.length > 0 ? { bloodType: bloodTypes.join(',') } : {}),
            }}
          />

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
            {actresses.map((actress) => (
              <ActressCard key={actress.id} actress={actress} compact />
            ))}
          </div>

          {/* ページネーション（下部） */}
          <Pagination
            total={totalCount}
            page={page}
            perPage={PER_PAGE}
            basePath={localizedHref('/', locale)}
            position="bottom"
            queryParams={{
              ...(query ? { q: query } : {}),
              ...(initialFilter ? { initial: initialFilter } : {}),
              ...(sortBy !== 'recent' ? { sort: sortBy } : {}),
              ...(includeTags.length > 0 ? { include: includeTags.join(',') } : {}),
              ...(excludeTags.length > 0 ? { exclude: excludeTags.join(',') } : {}),
              ...(!isFanzaSite && includeAsps.length > 0 ? { includeAsp: includeAsps.join(',') } : {}),
              ...(!isFanzaSite && excludeAsps.length > 0 ? { excludeAsp: excludeAsps.join(',') } : {}),
              ...(hasVideo ? { hasVideo: 'true' } : {}),
              ...(hasImage ? { hasImage: 'true' } : {}),
              ...(hasReview ? { hasReview: 'true' } : {}),
              ...(cupSizes.length > 0 ? { cup: cupSizes.join(',') } : {}),
              ...(heightMin !== undefined ? { heightMin: String(heightMin) } : {}),
              ...(heightMax !== undefined ? { heightMax: String(heightMax) } : {}),
              ...(bloodTypes.length > 0 ? { bloodType: bloodTypes.join(',') } : {}),
            }}
          />

          {/* 商品一覧へのリンク */}
          <div className="mt-8 sm:mt-12 pt-6 sm:pt-8 border-t theme-section-border">
            <Link
              href={localizedHref('/products', locale)}
              className="flex items-center justify-between p-4 theme-content hover:opacity-90 rounded-lg border theme-border hover:border-pink-500 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">🎬</span>
                <div>
                  <span className="theme-text font-medium">{t('viewProductList')}</span>
                  <p className="theme-text-muted text-sm mt-0.5">{t('viewProductListDesc')}</p>
                </div>
              </div>
              <svg className="w-5 h-5 theme-text-muted group-hover:text-pink-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
