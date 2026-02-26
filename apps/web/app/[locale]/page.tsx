import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { SortDropdown } from '@adult-v/shared/components';
import Pagination from '@/components/Pagination';
import PerPageDropdown from '@/components/PerPageDropdown';
import PerformerGridWithComparison from '@/components/PerformerGridWithComparison';
import ProductCard from '@/components/ProductCard';
import ProductSortDropdown from '@/components/ProductSortDropdown';
import ActressListFilter from '@/components/ActressListFilter';
import CompactSaleStrip from '@/components/CompactSaleStrip';
import CompactTrendingStrip from '@/components/CompactTrendingStrip';
import DiscoveryTabs from '@/components/DiscoveryTabs';
import {
  getActresses,
  getActressesCount,
  getProducts,
  getProductsCount,
  getTags,
  getAspStats,
  getSaleProducts,
  SaleProduct,
  getTrendingActresses,
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
// データキャッシュ: 900秒TTL（ページは毎回dynamic renderだがデータはキャッシュ）
const getCachedTags = unstable_cache(async () => getTags(), ['homepage-tags'], { revalidate: 900, tags: ['tags'] });

const getCachedAspStats = unstable_cache(async () => getAspStats(), ['homepage-asp-stats'], {
  revalidate: 900,
  tags: ['asp-stats'],
});

// トップページ全データを一括キャッシュ（8クエリ→1キャッシュルックアップ）
const getCachedTopPageData = unstable_cache(
  async (locale: string, perPage: number, isFanzaSite: boolean, includeAsps: string[]) => {
    const [allTags, aspStatsResult, actresses, totalCount, saleProducts, trendingActresses] = await Promise.all([
      getTags().catch(() => [] as Awaited<ReturnType<typeof getTags>>),
      !isFanzaSite
        ? getAspStats().catch(() => [] as Array<{ aspName: string; productCount: number; actressCount: number }>)
        : Promise.resolve([] as Array<{ aspName: string; productCount: number; actressCount: number }>),
      getActresses({ limit: perPage, offset: 0, locale, includeAsps }).catch(
        () => [] as Awaited<ReturnType<typeof getActresses>>,
      ),
      getActressesCount({ includeAsps }).catch(() => 0),
      getSaleProducts({ limit: 8 }).catch(() => [] as SaleProduct[]),
      (typeof getTrendingActresses === 'function' ? getTrendingActresses({ limit: 8 }) : Promise.resolve([])).catch(
        () => [] as Array<{ id: number; name: string; thumbnailUrl: string | null; releaseCount?: number }>,
      ),
    ]);
    return {
      allTags,
      aspStatsResult,
      actresses,
      totalCount,
      saleProducts,
      trendingActresses,
    };
  },
  ['homepage-top-data'],
  { revalidate: 900, tags: ['homepage-top'] },
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

  // ビュー切り替え: actresses (デフォルト) / products
  const view = searchParamsData['view'] === 'products' ? 'products' : 'actresses';

  // FANZAサイトかどうかを判定
  const [serverAspFilter, isFanzaSite] = await Promise.all([getServerAspFilter(), isServerFanzaSite()]);

  const query =
    typeof searchParamsData['q'] === 'string' ? searchParamsData['q'].trim().slice(0, 500) || undefined : undefined;

  // ソート: ビューによって異なるデフォルト値・型
  const sortByRaw = typeof searchParamsData['sort'] === 'string' ? searchParamsData['sort'] : undefined;
  const actressSortBy = (sortByRaw || 'recent') as
    | 'nameAsc'
    | 'nameDesc'
    | 'productCountDesc'
    | 'productCountAsc'
    | 'recent';
  const productSortBy = (sortByRaw || 'releaseDateDesc') as string;
  const sortBy = view === 'products' ? productSortBy : actressSortBy;
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

  // ホームページ判定（フィルター・検索なし、1ページ目）— ビューに依存しない
  const isHomepage =
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
    page === 1 &&
    perPage === DEFAULT_PER_PAGE;

  // TOPページ判定（女優ビュー + ホームページ + デフォルトソート → 一括キャッシュ用）
  const isTopPage = isHomepage && view === 'actresses' && actressSortBy === 'recent';

  // 共通のクエリオプション（exactOptionalPropertyTypes対応）
  const actressQueryOptions = {
    ...(searchQuery && { query: searchQuery }),
    includeTags,
    excludeTags,
    sortBy: actressSortBy,
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

  // 作品ビュー用クエリオプション
  const productQueryOptions = {
    ...(query && { query }),
    ...(includeAsps.length > 0 && { providers: includeAsps }),
    ...(excludeAsps.length > 0 && { excludeProviders: excludeAsps }),
    ...(hasVideo && { hasVideo: true as const }),
    ...(hasImage && { hasImage: true as const }),
    ...(onSale && { onSale: true as const }),
    ...(includeTags.length > 0 && { tags: includeTags }),
    ...(excludeTags.length > 0 && { excludeTags }),
  };

  // データ取得（トップページは一括キャッシュで高速化、フィルター時は個別クエリ）
  let allTags: Awaited<ReturnType<typeof getTags>>;
  let aspStatsResult: Array<{ aspName: string; productCount: number; actressCount: number }>;
  let actresses: Awaited<ReturnType<typeof getActresses>>;
  let products: Awaited<ReturnType<typeof getProducts>>;
  let totalCount: number;
  let saleProducts: SaleProduct[];
  let trendingActresses: Array<{ id: number; name: string; thumbnailUrl: string | null; releaseCount?: number }>;

  if (isTopPage) {
    // トップページ: 全データを一括キャッシュ（8クエリ→1キャッシュルックアップ、300秒TTL）
    const cached = await getCachedTopPageData(locale, perPage, isFanzaSite, includeAsps);
    allTags = cached.allTags;
    aspStatsResult = cached.aspStatsResult;
    actresses = cached.actresses;
    products = [];
    totalCount = cached.totalCount;
    saleProducts = cached.saleProducts;
    trendingActresses = cached.trendingActresses;
  } else if (view === 'products') {
    // 作品ビュー: 作品リストを取得（ホームページならセール・トレンドも取得）
    [allTags, aspStatsResult, products, totalCount, saleProducts, trendingActresses] = await Promise.all([
      getCachedTags().catch(() => [] as Awaited<ReturnType<typeof getTags>>),
      !isFanzaSite
        ? getCachedAspStats().catch(() => [] as Array<{ aspName: string; productCount: number; actressCount: number }>)
        : Promise.resolve([] as Array<{ aspName: string; productCount: number; actressCount: number }>),
      getProducts({
        ...productQueryOptions,
        sortBy: sortBy as any,
        limit: perPage,
        offset,
        locale,
      }).catch((error) => {
        console.error('Failed to fetch products:', error);
        return [] as Awaited<ReturnType<typeof getProducts>>;
      }),
      getProductsCount(productQueryOptions).catch((error) => {
        console.error('Failed to fetch products count:', error);
        return 0;
      }),
      isHomepage
        ? getSaleProducts({ limit: 8 }).catch(() => [] as SaleProduct[])
        : Promise.resolve([] as SaleProduct[]),
      isHomepage
        ? (typeof getTrendingActresses === 'function' ? getTrendingActresses({ limit: 8 }) : Promise.resolve([])).catch(
            () => [] as Array<{ id: number; name: string; thumbnailUrl: string | null; releaseCount?: number }>,
          )
        : Promise.resolve(
            [] as Array<{ id: number; name: string; thumbnailUrl: string | null; releaseCount?: number }>,
          ),
    ]);
    actresses = [];
  } else {
    // 女優ビュー（フィルター・ページネーション時）: 個別クエリ
    [allTags, aspStatsResult, actresses, totalCount, saleProducts, trendingActresses] = await Promise.all([
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
      Promise.resolve([] as Array<{ id: number; name: string; thumbnailUrl: string | null; releaseCount?: number }>),
    ]);
    products = [];
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

  // CompactSaleStrip用のスカラー値を算出
  const saleCount = saleProducts.length;
  const maxDiscount = saleProducts.reduce((max, p) => Math.max(max, p.discountPercent), 0);
  const nearestEndAt = saleProducts.reduce<string | null>((nearest, p) => {
    if (!p.endAt) return nearest;
    const iso = p.endAt.toISOString();
    return !nearest || iso < nearest ? iso : nearest;
  }, null);

  // クイックフィルター用トグルURL生成
  const filterBasePath = localizedHref('/', locale);
  function getToggleHref(key: string): string {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParamsData)) {
      if (k === 'page' || k === key) continue;
      if (typeof v === 'string') params.set(k, v);
    }
    if (searchParamsData[key] !== 'true') {
      params.set(key, 'true');
    }
    const qs = params.toString();
    return `${filterBasePath}${qs ? `?${qs}` : ''}`;
  }
  const chipLabels =
    locale === 'en'
      ? { onSale: 'Sale', hasVideo: 'Video', hasImage: 'Images', hasReview: 'Reviews' }
      : { onSale: 'セール', hasVideo: '動画', hasImage: '画像', hasReview: 'レビュー' };

  // LCP最適化: 最初の画像をpreload
  const firstActressImageUrl =
    view === 'actresses' && actresses.length > 0
      ? normalizeImageUrlForPreload(actresses[0]?.thumbnail || actresses[0]?.heroImage)
      : null;
  const firstProductImageUrl =
    view === 'products' && products.length > 0 ? normalizeImageUrlForPreload(products[0]?.imageUrl) : null;

  // ビュー切り替え用ラベル
  const viewLabels =
    locale === 'en' ? { actresses: 'Actresses', products: 'Products' } : { actresses: '女優', products: '作品' };

  // ページネーション共通クエリパラメータ
  const paginationParams = {
    ...(view === 'products' ? { view: 'products' } : {}),
    ...(query ? { q: query } : {}),
    ...(initialFilter ? { initial: initialFilter } : {}),
    ...(view === 'actresses' && actressSortBy !== 'recent' ? { sort: actressSortBy } : {}),
    ...(view === 'products' && productSortBy !== 'releaseDateDesc' ? { sort: productSortBy } : {}),
    ...(includeTags.length > 0 ? { include: includeTags.join(',') } : {}),
    ...(excludeTags.length > 0 ? { exclude: excludeTags.join(',') } : {}),
    ...(userSetIncludeAsps.length > 0 ? { includeAsp: userSetIncludeAsps.join(',') } : {}),
    ...(userSetExcludeAsps.length > 0 ? { excludeAsp: userSetExcludeAsps.join(',') } : {}),
    ...(hasVideo ? { hasVideo: 'true' } : {}),
    ...(hasImage ? { hasImage: 'true' } : {}),
    ...(hasReview ? { hasReview: 'true' } : {}),
    ...(onSale ? { onSale: 'true' } : {}),
    ...(perPage !== DEFAULT_PER_PAGE ? { perPage: String(perPage) } : {}),
  };

  return (
    <main className="theme-body min-h-screen">
      {/* LCP最適化: 最初の画像をpreload */}
      {firstActressImageUrl && <link rel="preload" as="image" href={firstActressImageUrl} fetchPriority="high" />}
      {firstProductImageUrl && <link rel="preload" as="image" href={firstProductImageUrl} fetchPriority="high" />}
      {/* FAQスキーマ（トップページのみ） */}
      {faqSchema && <JsonLD data={faqSchema} />}

      {/* コンパクトセールストリップ（ホームページのみ） */}
      {isHomepage && saleCount > 0 && (
        <CompactSaleStrip
          saleCount={saleCount}
          maxDiscount={maxDiscount}
          nearestEndAt={nearestEndAt}
          locale={locale}
          topProducts={saleProductsForDisplay.slice(0, 4).map((p) => ({
            productId: p.productId,
            title: p.title,
            thumbnailUrl: p.thumbnailUrl,
            affiliateUrl: p.affiliateUrl,
            salePrice: p.salePrice,
            discountPercent: p.discountPercent,
            aspName: p.aspName,
          }))}
        />
      )}

      {/* トレンド女優ストリップ（ホームページのみ） */}
      {isHomepage && <CompactTrendingStrip trendingActresses={trendingActresses} locale={locale} />}

      {/* サイトタイトル + ビュー切り替えタブ */}
      <div className="container mx-auto px-3 pt-3 sm:px-4">
        {isTopPage && <h1 className="theme-text mb-1.5 text-base font-bold sm:text-lg">{t('siteTitle')}</h1>}
        <div className="mb-2 flex items-center border-b border-white/10">
          <Link
            href={localizedHref('/', locale)}
            scroll={false}
            className={`relative inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold transition-colors ${
              view === 'actresses'
                ? 'text-fuchsia-400 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-fuchsia-400'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            {viewLabels.actresses}
            <span className={`text-[10px] font-normal ${view === 'actresses' ? 'text-gray-500' : 'text-gray-600'}`}>
              {view === 'actresses' ? totalCount.toLocaleString() : ''}
            </span>
          </Link>
          <Link
            href={`${localizedHref('/', locale)}?view=products`}
            scroll={false}
            className={`relative inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold transition-colors ${
              view === 'products'
                ? 'text-fuchsia-400 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-fuchsia-400'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
              />
            </svg>
            {viewLabels.products}
            <span className={`text-[10px] font-normal ${view === 'products' ? 'text-gray-500' : 'text-gray-600'}`}>
              {view === 'products' ? totalCount.toLocaleString() : ''}
            </span>
          </Link>
        </div>
      </div>

      {/* メインコンテンツ */}
      <section id="list" className="scroll-mt-4 py-2 sm:py-3">
        <div className="container mx-auto px-3 sm:px-4">
          {/* 共通クイックフィルター */}
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <Link
              href={getToggleHref('onSale')}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                onSale
                  ? 'bg-red-600/80 text-white shadow-sm shadow-red-500/20'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200'
              }`}
            >
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M5 2a2 2 0 00-2 2v14l3.5-2 3.5 2 3.5-2 3.5 2V4a2 2 0 00-2-2H5zm2.5 3a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm6.207.293a1 1 0 00-1.414 0l-6 6a1 1 0 101.414 1.414l6-6a1 1 0 000-1.414zM12.5 10a1.5 1.5 0 100 3 1.5 1.5 0 000-3z"
                  clipRule="evenodd"
                />
              </svg>
              {chipLabels.onSale}
            </Link>
            <Link
              href={getToggleHref('hasVideo')}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                hasVideo
                  ? 'bg-fuchsia-600/80 text-white shadow-sm shadow-fuchsia-500/20'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200'
              }`}
            >
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              {chipLabels.hasVideo}
            </Link>
            <Link
              href={getToggleHref('hasImage')}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                hasImage
                  ? 'bg-blue-600/80 text-white shadow-sm shadow-blue-500/20'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200'
              }`}
            >
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14"
                />
              </svg>
              {chipLabels.hasImage}
            </Link>
            {view === 'actresses' && (
              <Link
                href={getToggleHref('hasReview')}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  hasReview
                    ? 'bg-purple-600/80 text-white shadow-sm shadow-purple-500/20'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200'
                }`}
              >
                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                {chipLabels.hasReview}
              </Link>
            )}
            <span className="flex-1" />
            <PerPageDropdown perPage={perPage} basePath={localizedHref('/', locale)} />
            {view === 'actresses' ? (
              <SortDropdown sortBy={actressSortBy} theme="dark" />
            ) : (
              <ProductSortDropdown sortBy={productSortBy} basePath={`${localizedHref('/', locale)}?view=products`} />
            )}
          </div>

          {view === 'actresses' ? (
            <>
              {/* 女優ビュー: 詳細フィルター */}
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

              <PerformerGridWithComparison
                performers={actresses}
                locale={locale}
                size="compact"
                className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 md:gap-3 lg:grid-cols-6 xl:grid-cols-7"
              />
            </>
          ) : (
            <>
              {/* 作品グリッド */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 md:gap-3 lg:grid-cols-5 xl:grid-cols-6">
                {products.map((product, idx) => (
                  <ProductCard key={product.id} product={product} size="compact" priority={idx < 4} />
                ))}
              </div>
              {products.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <svg className="mb-3 h-12 w-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <p className="text-sm text-gray-400">
                    {locale === 'en'
                      ? 'No products found. Try adjusting your filters.'
                      : '作品が見つかりませんでした。フィルターを変更してみてください。'}
                  </p>
                </div>
              )}
            </>
          )}

          {/* ページネーション（下部） */}
          <Pagination
            total={totalCount}
            page={page}
            perPage={perPage}
            basePath={localizedHref('/', locale)}
            position="bottom"
            queryParams={paginationParams}
          />
        </div>
      </section>

      {/* ディスカバリーセクション（ホームページのみ） */}
      {isHomepage && <DiscoveryTabs locale={locale} saleProducts={saleProductsForDisplay} />}
    </main>
  );
}
