import { getTranslations } from 'next-intl/server';
import { SortDropdown, FanzaNewReleasesSection } from '@adult-v/shared/components';
import Pagination from '@/components/Pagination';
import PerPageDropdown from '@/components/PerPageDropdown';
import PerformerGridWithComparison from '@/components/PerformerGridWithComparison';
import ActressListFilter from '@/components/ActressListFilter';
import { TopPageUpperSections, TopPageLowerSections } from '@/components/TopPageSections';
import TopPageSectionNav from '@/components/TopPageSectionNav';
import HeroSection from '@/components/HeroSection';
import {
  getActresses,
  getActressesCount,
  getTags,
  getAspStats,
  getSaleProducts,
  getUncategorizedProductsCount,
  SaleProduct,
  getTrendingActresses,
  getProducts,
} from '@/lib/db/queries';
import { generateBaseMetadata, generateFAQSchema, getHomepageFAQs } from '@/lib/seo';
import { JsonLD } from '@/components/JsonLD';
import { Metadata } from 'next';
import { getServerAspFilter, isServerFanzaSite } from '@/lib/server/site-mode';
import { localizedHref } from '@adult-v/shared/i18n';
import { unstable_cache } from 'next/cache';

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
  const hasQuery = !!searchParamsData['q'];
  const hasFilters = !!(
    searchParamsData['initial'] ||
    searchParamsData['include'] ||
    searchParamsData['exclude'] ||
    searchParamsData['includeAsp'] ||
    searchParamsData['excludeAsp'] ||
    searchParamsData['hasVideo'] ||
    searchParamsData['hasImage'] ||
    searchParamsData['hasReview'] ||
    searchParamsData['cup'] ||
    searchParamsData['heightMin'] ||
    searchParamsData['heightMax'] ||
    searchParamsData['bloodType'] ||
    searchParamsData['debutYear'] ||
    searchParamsData['minWorks'] ||
    searchParamsData['onSale']
  );
  // ページネーション: 1-5ページ目は許可、6ページ目以降はnoindex
  const pageNum = Math.max(1, Math.min(parseInt(searchParamsData['page'] as string) || 1, 500));
  const hasDeepPagination = pageNum > 5;
  // ソートパラメータは許可（重複はcanonicalで制御）
  // const hasNonDefaultSort は削除 - ソート結果もインデックス可能に

  const baseUrl = process.env['NEXT_PUBLIC_SITE_URL'] || 'https://example.com';

  const metadata = generateBaseMetadata(
    t('title'),
    t('description', { count: approximateCount }),
    undefined,
    localizedHref('/', locale),
    undefined,
    locale,
  );

  // hreflang/canonical設定（?hl=形式）
  const alternates = {
    canonical: baseUrl,
    languages: {
      ja: baseUrl,
      en: `${baseUrl}?hl=en`,
      zh: `${baseUrl}?hl=zh`,
      'zh-TW': `${baseUrl}?hl=zh-TW`,
      ko: `${baseUrl}?hl=ko`,
      'x-default': baseUrl,
    },
  };

  // 検索・フィルター・6ページ目以降はnoindex（重複コンテンツ防止）
  // 1-5ページ目とソート結果は許可（ユーザー検索経路を確保）
  if (hasQuery || hasFilters || hasDeepPagination) {
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

// getTranslationsがheaders()を呼ぶためISR(revalidate)は無効 → force-dynamic
// データキャッシュはunstable_cacheで個別管理（300秒TTL）
export const dynamic = 'force-dynamic';

// キャッシュ付きクエリ（5xxエラー削減のためDB負荷を軽減）
// データキャッシュ: 300秒TTL（ページは毎回dynamic renderだがデータはキャッシュ）
const getCachedTags = unstable_cache(async () => getTags(), ['homepage-tags'], { revalidate: 300, tags: ['tags'] });

const getCachedAspStats = unstable_cache(async () => getAspStats(), ['homepage-asp-stats'], {
  revalidate: 300,
  tags: ['asp-stats'],
});

const getCachedSaleProducts = unstable_cache(
  async (limit: number) => getSaleProducts({ limit }),
  ['homepage-sale-products'],
  { revalidate: 300, tags: ['sale-products'] },
);

const getCachedUncategorizedCount = unstable_cache(
  async () => getUncategorizedProductsCount(),
  ['homepage-uncategorized-count'],
  { revalidate: 300, tags: ['uncategorized'] },
);

const getCachedTrendingActresses = unstable_cache(
  async (limit: number) => {
    if (typeof getTrendingActresses === 'function') {
      return getTrendingActresses({ limit });
    }
    return [];
  },
  ['homepage-trending-actresses'],
  { revalidate: 300, tags: ['trending-actresses'] },
);

const getCachedFanzaProducts = unstable_cache(
  async (limit: number) => getProducts({ limit, sortBy: 'releaseDateDesc', providers: ['FANZA'] }),
  ['homepage-fanza-products'],
  { revalidate: 300, tags: ['fanza-products'] },
);

// トップページ全データを一括キャッシュ（8クエリ→1キャッシュルックアップ）
const getCachedTopPageData = unstable_cache(
  async (locale: string, perPage: number, isFanzaSite: boolean, includeAsps: string[]) => {
    const [
      allTags,
      aspStatsResult,
      actresses,
      totalCount,
      saleProducts,
      uncategorizedCount,
      trendingActresses,
      fanzaProducts,
    ] = await Promise.all([
      getTags().catch(() => [] as Awaited<ReturnType<typeof getTags>>),
      !isFanzaSite
        ? getAspStats().catch(() => [] as Array<{ aspName: string; productCount: number; actressCount: number }>)
        : Promise.resolve([] as Array<{ aspName: string; productCount: number; actressCount: number }>),
      getActresses({ limit: perPage, offset: 0, locale, includeAsps }).catch(
        () => [] as Awaited<ReturnType<typeof getActresses>>,
      ),
      getActressesCount({ includeAsps }).catch(() => 0),
      getSaleProducts({ limit: 8 }).catch(() => [] as SaleProduct[]),
      getUncategorizedProductsCount().catch(() => 0),
      (typeof getTrendingActresses === 'function' ? getTrendingActresses({ limit: 8 }) : Promise.resolve([])).catch(
        () => [] as Array<{ id: number; name: string; thumbnailUrl: string | null; releaseCount?: number }>,
      ),
      !isFanzaSite
        ? getProducts({ limit: 8, sortBy: 'releaseDateDesc', providers: ['FANZA'] }).catch(
            () => [] as Awaited<ReturnType<typeof getProducts>>,
          )
        : Promise.resolve([] as Awaited<ReturnType<typeof getProducts>>),
    ]);
    return {
      allTags,
      aspStatsResult,
      actresses,
      totalCount,
      saleProducts,
      uncategorizedCount,
      trendingActresses,
      fanzaProducts,
    };
  },
  ['homepage-top-data'],
  { revalidate: 300, tags: ['homepage-top'] },
);

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const DEFAULT_PER_PAGE = 48;
const VALID_PER_PAGE = [12, 24, 48, 96];

export default async function Home({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'homepage' });
  const tCommon = await getTranslations({ locale, namespace: 'common' });
  const tFilter = await getTranslations({ locale, namespace: 'filter' });

  const searchParamsData = await searchParams;
  const page = Math.max(1, Math.min(Number(searchParamsData['page']) || 1, 500));

  // 表示件数（URLパラメータから取得、無効な値はデフォルトに）
  const perPageParam = Number(searchParamsData['perPage']);
  const perPage = VALID_PER_PAGE.includes(perPageParam) ? perPageParam : DEFAULT_PER_PAGE;

  // FANZAサイトかどうかを判定
  const [serverAspFilter, isFanzaSite] = await Promise.all([getServerAspFilter(), isServerFanzaSite()]);

  const query =
    typeof searchParamsData['q'] === 'string' ? searchParamsData['q'].trim().slice(0, 500) || undefined : undefined;
  const sortBy = (typeof searchParamsData['sort'] === 'string' ? searchParamsData['sort'] : 'recent') as
    | 'nameAsc'
    | 'nameDesc'
    | 'productCountDesc'
    | 'productCountAsc'
    | 'recent';
  const initialFilter = typeof searchParamsData['initial'] === 'string' ? searchParamsData['initial'] : undefined;

  // 対象タグ（include）と除外タグ（exclude）を取得
  const includeTags =
    typeof searchParamsData['include'] === 'string'
      ? searchParamsData['include'].split(',').filter(Boolean)
      : Array.isArray(searchParamsData['include'])
        ? searchParamsData['include']
        : [];
  const excludeTags =
    typeof searchParamsData['exclude'] === 'string'
      ? searchParamsData['exclude'].split(',').filter(Boolean)
      : Array.isArray(searchParamsData['exclude'])
        ? searchParamsData['exclude']
        : [];

  // ASPフィルターを取得（FANZAサイトの場合は自動的にFANZAのみをフィルタ）
  // ユーザー選択を優先し、serverAspFilterは許可リストとして機能
  const urlIncludeAsps =
    typeof searchParamsData['includeAsp'] === 'string'
      ? searchParamsData['includeAsp'].split(',').filter(Boolean)
      : Array.isArray(searchParamsData['includeAsp'])
        ? searchParamsData['includeAsp']
        : [];
  const includeAsps =
    urlIncludeAsps.length > 0
      ? serverAspFilter
        ? urlIncludeAsps.filter((asp) => serverAspFilter.some((allowed) => allowed.toUpperCase() === asp.toUpperCase())) // 許可リスト内でフィルター（大文字小文字を無視）
        : urlIncludeAsps
      : serverAspFilter || []; // デフォルトはserverAspFilter（FANZAサイトなど）
  const excludeAsps =
    typeof searchParamsData['excludeAsp'] === 'string'
      ? searchParamsData['excludeAsp'].split(',').filter(Boolean)
      : Array.isArray(searchParamsData['excludeAsp'])
        ? searchParamsData['excludeAsp']
        : [];

  // hasVideo/hasImage/hasReviewフィルターを取得
  const hasVideo = searchParamsData['hasVideo'] === 'true';
  const hasImage = searchParamsData['hasImage'] === 'true';
  const hasReview = searchParamsData['hasReview'] === 'true';

  // 女優特徴フィルターを取得
  const cupSizes =
    typeof searchParamsData['cup'] === 'string' ? searchParamsData['cup'].split(',').filter(Boolean) : [];
  const heightMin =
    typeof searchParamsData['heightMin'] === 'string' ? parseInt(searchParamsData['heightMin'], 10) : undefined;
  const heightMax =
    typeof searchParamsData['heightMax'] === 'string' ? parseInt(searchParamsData['heightMax'], 10) : undefined;
  const bloodTypes =
    typeof searchParamsData['bloodType'] === 'string' ? searchParamsData['bloodType'].split(',').filter(Boolean) : [];
  const debutYear = typeof searchParamsData['debutYear'] === 'string' ? searchParamsData['debutYear'] : undefined;
  const minWorks =
    typeof searchParamsData['minWorks'] === 'string' ? parseInt(searchParamsData['minWorks'], 10) : undefined;
  const onSale = searchParamsData['onSale'] === 'true';

  const offset = (page - 1) * perPage;

  // "etc"の場合は特別処理（50音・アルファベット以外）
  const isEtcFilter = initialFilter === 'etc';
  let searchQuery = initialFilter || query;
  if (isEtcFilter) {
    // "etc"の場合はクエリとして渡さない
    searchQuery = undefined;
  }

  // TOPページ判定（Promise.allの前で必要）
  // ユーザーがURLで明示的に選択したASPフィルターを判定（serverAspFilterの自動適用とは別）
  const userSetIncludeAsps = urlIncludeAsps; // ユーザーが明示的に選択したもの
  const userSetExcludeAsps = excludeAsps;
  const isTopPage =
    !query &&
    !initialFilter &&
    includeTags.length === 0 &&
    excludeTags.length === 0 &&
    userSetIncludeAsps.length === 0 &&
    userSetExcludeAsps.length === 0 &&
    !hasVideo &&
    !hasImage &&
    !hasReview &&
    !onSale &&
    cupSizes.length === 0 &&
    !heightMin &&
    !heightMax &&
    bloodTypes.length === 0 &&
    !debutYear &&
    !minWorks &&
    sortBy === 'recent' &&
    page === 1 &&
    perPage === DEFAULT_PER_PAGE;

  // 共通のクエリオプション（exactOptionalPropertyTypes対応）
  const actressQueryOptions = {
    ...(searchQuery && { query: searchQuery }),
    includeTags,
    excludeTags,
    sortBy,
    excludeInitials: isEtcFilter,
    includeAsps,
    excludeAsps,
    ...(hasVideo && { hasVideo: true as const }),
    ...(hasImage && { hasImage: true as const }),
    ...(hasReview && { hasReview: true as const }),
    // 女優特徴フィルター
    ...(cupSizes.length > 0 && { cupSizes }),
    ...(heightMin !== undefined && { heightMin }),
    ...(heightMax !== undefined && { heightMax }),
    ...(bloodTypes.length > 0 && { bloodTypes }),
    ...(debutYear && { debutYearRange: debutYear }),
    ...(minWorks !== undefined && minWorks > 0 && { minWorks }),
    ...(onSale && { onSale: true as const }),
  };

  // データ取得（トップページは一括キャッシュで高速化、フィルター時は個別クエリ）
  let allTags: Awaited<ReturnType<typeof getTags>>;
  let aspStatsResult: Array<{ aspName: string; productCount: number; actressCount: number }>;
  let actresses: Awaited<ReturnType<typeof getActresses>>;
  let totalCount: number;
  let saleProducts: SaleProduct[];
  let uncategorizedCount: number;
  let trendingActresses: Array<{ id: number; name: string; thumbnailUrl: string | null; releaseCount?: number }>;
  let fanzaProducts: Awaited<ReturnType<typeof getProducts>>;

  if (isTopPage) {
    // トップページ: 全データを一括キャッシュ（8クエリ→1キャッシュルックアップ、300秒TTL）
    const cached = await getCachedTopPageData(locale, perPage, isFanzaSite, includeAsps);
    allTags = cached.allTags;
    aspStatsResult = cached.aspStatsResult;
    actresses = cached.actresses;
    totalCount = cached.totalCount;
    saleProducts = cached.saleProducts;
    uncategorizedCount = cached.uncategorizedCount;
    trendingActresses = cached.trendingActresses;
    fanzaProducts = cached.fanzaProducts;
  } else {
    // フィルター・ページネーション時: 個別クエリ（キャッシュ付き）
    [
      allTags,
      aspStatsResult,
      actresses,
      totalCount,
      saleProducts,
      uncategorizedCount,
      trendingActresses,
      fanzaProducts,
    ] = await Promise.all([
      getCachedTags().catch((error) => {
        console.error('Failed to fetch tags:', error);
        return [] as Awaited<ReturnType<typeof getTags>>;
      }),
      !isFanzaSite
        ? getCachedAspStats().catch((error) => {
            console.error('Failed to fetch ASP stats:', error);
            return [] as Array<{ aspName: string; productCount: number; actressCount: number }>;
          })
        : Promise.resolve([] as Array<{ aspName: string; productCount: number; actressCount: number }>),
      getActresses({
        ...actressQueryOptions,
        limit: perPage,
        offset,
        locale,
      }).catch((error) => {
        console.error('Failed to fetch actresses:', error);
        return [] as Awaited<ReturnType<typeof getActresses>>;
      }),
      getActressesCount(actressQueryOptions).catch((error) => {
        console.error('Failed to fetch actresses count:', error);
        return 0;
      }),
      Promise.resolve([] as SaleProduct[]),
      Promise.resolve(0),
      Promise.resolve([] as Array<{ id: number; name: string; thumbnailUrl: string | null; releaseCount?: number }>),
      Promise.resolve([] as Awaited<ReturnType<typeof getProducts>>),
    ]);
  }

  const genreTags = allTags.filter((tag) => tag.category !== 'site');
  const aspStats = aspStatsResult;

  // 利用可能なASP一覧（aspStatsから動的に生成、画面上部と一致させる）
  const availableAsps = aspStats.map((stat) => ({
    id: stat.aspName,
    name: stat.aspName,
  }));

  // ASP別商品数をマップに変換（フィルター表示用）
  const aspProductCounts: Record<string, number> = {};
  aspStats.forEach((stat) => {
    aspProductCounts[stat.aspName] = stat.productCount;
  });

  // FAQスキーマ（トップページのみ）
  const faqSchema = isTopPage ? generateFAQSchema(getHomepageFAQs(locale)) : null;

  // セール商品をクライアントコンポーネント用に変換
  const saleProductsForDisplay = saleProducts.map((p) => ({
    productId: p.productId,
    normalizedProductId: p.normalizedProductId,
    title: p.title,
    thumbnailUrl: p.thumbnailUrl,
    aspName: p.aspName,
    affiliateUrl: p.affiliateUrl,
    regularPrice: p.regularPrice,
    salePrice: p.salePrice,
    discountPercent: p.discountPercent,
    saleName: p.saleName,
    saleType: p.saleType,
    endAt: p.endAt ? p.endAt.toISOString() : null,
    performers: p.performers,
  }));

  // 共通セクション用の翻訳
  const layoutTranslations = {
    viewProductList: t('viewProductList'),
    viewProductListDesc: t('viewProductListDesc'),
    uncategorizedBadge: t('uncategorizedBadge'),
    uncategorizedDescription: t('uncategorizedDescription'),
    uncategorizedCount: t('uncategorizedCount', { count: uncategorizedCount }),
  };

  // LCP最適化: 最初の女優画像をpreload（コンパクトモードではthumbnail優先）
  const firstActressImageUrl =
    actresses.length > 0 ? normalizeImageUrlForPreload(actresses[0]?.thumbnail || actresses[0]?.heroImage) : null;

  return (
    <div className="theme-body min-h-screen">
      {/* LCP最適化: 最初の画像をpreload */}
      {firstActressImageUrl && <link rel="preload" as="image" href={firstActressImageUrl} fetchPriority="high" />}
      {/* FAQスキーマ（トップページのみ） */}
      {faqSchema && <JsonLD data={faqSchema} />}

      {/* ヒーローセクション（トップページのみ） */}
      {isTopPage && (
        <HeroSection
          locale={locale}
          saleProducts={saleProductsForDisplay}
          trendingActresses={trendingActresses}
          totalActressCount={totalCount > 0 ? totalCount : 38000}
          totalProductCount={120000}
        />
      )}

      {/* セクションナビゲーション */}
      {isTopPage && (
        <TopPageSectionNav
          locale={locale}
          hasSaleProducts={saleProducts.length > 0}
          hasRecentlyViewed={true}
          hasRecommendations={true}
        />
      )}

      {/* トップページ上部セクション（最近見た作品、レコメンド - セールはヒーローに移動） */}
      {isTopPage && (
        <section className="container mx-auto px-3 py-3 sm:px-4">
          <TopPageUpperSections locale={locale} saleProducts={[]} pageId="home" />
        </section>
      )}

      {/* 女優一覧（メインコンテンツを最優先で表示） */}
      <section id="list" className="scroll-mt-4 py-3 sm:py-4 md:py-6">
        <div className="container mx-auto px-3 sm:px-4">
          <div className="mb-2 sm:mb-3">
            <h1 className="theme-text mb-0.5 text-xl font-bold sm:text-2xl md:text-3xl">{tCommon('actresses')}</h1>
            <p className="theme-text-secondary text-sm sm:text-base">{t('actressCount', { count: totalCount })}</p>
          </div>

          {/* フィルター設定（頭文字検索 + タグフィルター） */}
          <ActressListFilter
            genreTags={genreTags}
            availableAsps={availableAsps}
            aspProductCounts={aspProductCounts}
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
              actressFeatures: tFilter('actressFeatures'),
              cupSize: tFilter('cupSize'),
              cupLabel: tFilter('cupLabel'),
              height: tFilter('height'),
              bloodType: tFilter('bloodType'),
              bloodTypeLabel: tFilter('bloodTypeLabel'),
              debutYear: tFilter('debutYear'),
              workCount: tFilter('workCount'),
              worksOrMore: tFilter('worksOrMore'),
              under: tFilter('under'),
              over: tFilter('over'),
            }}
          />

          {/* 並び順・表示件数 */}
          <div className="mb-2 flex items-center justify-end gap-4 sm:mb-4">
            <PerPageDropdown perPage={perPage} basePath={localizedHref('/', locale)} />
            <SortDropdown sortBy={sortBy} theme="dark" />
          </div>

          {/* ページネーション（上部） */}
          <Pagination
            total={totalCount}
            page={page}
            perPage={perPage}
            basePath={localizedHref('/', locale)}
            position="top"
            queryParams={{
              ...(query ? { q: query } : {}),
              ...(initialFilter ? { initial: initialFilter } : {}),
              ...(sortBy !== 'recent' ? { sort: sortBy } : {}),
              ...(includeTags.length > 0 ? { include: includeTags.join(',') } : {}),
              ...(excludeTags.length > 0 ? { exclude: excludeTags.join(',') } : {}),
              ...(userSetIncludeAsps.length > 0 ? { includeAsp: userSetIncludeAsps.join(',') } : {}),
              ...(userSetExcludeAsps.length > 0 ? { excludeAsp: userSetExcludeAsps.join(',') } : {}),
              ...(hasVideo ? { hasVideo: 'true' } : {}),
              ...(hasImage ? { hasImage: 'true' } : {}),
              ...(hasReview ? { hasReview: 'true' } : {}),
              ...(perPage !== DEFAULT_PER_PAGE ? { perPage: String(perPage) } : {}),
            }}
          />

          <PerformerGridWithComparison
            performers={actresses}
            locale={locale}
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4 lg:grid-cols-5 xl:grid-cols-6"
          />

          {/* ページネーション（下部） */}
          <Pagination
            total={totalCount}
            page={page}
            perPage={perPage}
            basePath={localizedHref('/', locale)}
            position="bottom"
            queryParams={{
              ...(query ? { q: query } : {}),
              ...(initialFilter ? { initial: initialFilter } : {}),
              ...(sortBy !== 'recent' ? { sort: sortBy } : {}),
              ...(includeTags.length > 0 ? { include: includeTags.join(',') } : {}),
              ...(excludeTags.length > 0 ? { exclude: excludeTags.join(',') } : {}),
              ...(userSetIncludeAsps.length > 0 ? { includeAsp: userSetIncludeAsps.join(',') } : {}),
              ...(userSetExcludeAsps.length > 0 ? { excludeAsp: userSetExcludeAsps.join(',') } : {}),
              ...(hasVideo ? { hasVideo: 'true' } : {}),
              ...(hasImage ? { hasImage: 'true' } : {}),
              ...(hasReview ? { hasReview: 'true' } : {}),
              ...(perPage !== DEFAULT_PER_PAGE ? { perPage: String(perPage) } : {}),
            }}
          />
        </div>
      </section>

      {/* トップページ下部セクション（おすすめ、トレンド等） */}
      {isTopPage && (
        <section className="container mx-auto px-3 py-3 sm:px-4">
          <TopPageLowerSections
            locale={locale}
            uncategorizedCount={uncategorizedCount}
            isTopPage={isTopPage}
            isFanzaSite={isFanzaSite}
            translations={layoutTranslations}
            pageId="home"
          />
        </section>
      )}

      {/* FANZA新作ピックアップ（FANZA専門サイトへの導線強化） */}
      {!isFanzaSite && isTopPage && (
        <FanzaNewReleasesSection
          locale={locale}
          products={fanzaProducts.map((p) => ({
            id: p.id,
            title: p.title,
            imageUrl: p.imageUrl ?? null,
            salePrice: p.salePrice,
            price: p.price,
            discount: p.discount,
          }))}
        />
      )}
    </div>
  );
}
