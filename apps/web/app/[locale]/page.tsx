import { getTranslations } from 'next-intl/server';
import { SortDropdown, FanzaNewReleasesSection } from '@adult-v/shared/components';
import Pagination from '@/components/Pagination';
import PerformerGridWithComparison from '@/components/PerformerGridWithComparison';
import ActressListFilter from '@/components/ActressListFilter';
import { TopPageUpperSections, TopPageLowerSections } from '@/components/TopPageSections';
import TopPageSectionNav from '@/components/TopPageSectionNav';
import { getActresses, getActressesCount, getTags, getAspStats, getSaleProducts, getUncategorizedProductsCount, SaleProduct } from '@/lib/db/queries';
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
    searchParamsData.hasReview ||
    searchParamsData.cup ||
    searchParamsData.heightMin ||
    searchParamsData.heightMax ||
    searchParamsData.bloodType
  );
  const hasPageParam = !!searchParamsData.page && searchParamsData.page !== '1';
  // sortパラメータがデフォルト以外の場合もnoindex（重複コンテンツ防止）
  const hasNonDefaultSort = !!searchParamsData.sort && searchParamsData.sort !== 'releaseCount';

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';

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
      'ja': baseUrl,
      'en': `${baseUrl}?hl=en`,
      'zh': `${baseUrl}?hl=zh`,
      'zh-TW': `${baseUrl}?hl=zh-TW`,
      'ko': `${baseUrl}?hl=ko`,
      'x-default': baseUrl,
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
  const heightMin = typeof searchParamsData.heightMin === 'string'
    ? parseInt(searchParamsData.heightMin, 10)
    : undefined;
  const heightMax = typeof searchParamsData.heightMax === 'string'
    ? parseInt(searchParamsData.heightMax, 10)
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

  // TOPページ判定（Promise.allの前で必要）
  // serverAspFilterが設定されている場合、それは自動適用されるフィルターなのでTOPページ判定には含めない
  const userSetIncludeAsps = serverAspFilter ? [] : includeAsps;
  const userSetExcludeAsps = serverAspFilter ? [] : excludeAsps;
  const isTopPage = !query && !initialFilter && includeTags.length === 0 && excludeTags.length === 0 && userSetIncludeAsps.length === 0 && userSetExcludeAsps.length === 0 && !hasVideo && !hasImage && !hasReview && cupSizes.length === 0 && !heightMin && !heightMax && bloodTypes.length === 0 && sortBy === 'recent' && page === 1;

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
    // 女優特徴フィルター
    cupSizes: cupSizes.length > 0 ? cupSizes : undefined,
    heightMin,
    heightMax,
    bloodTypes: bloodTypes.length > 0 ? bloodTypes : undefined,
  };

  // 並列クエリ実行（パフォーマンス最適化）
  // タグ、ASP統計、女優リスト、女優数、セール商品、未整理作品数を同時に取得
  const [allTags, aspStatsResult, actresses, totalCount, saleProducts, uncategorizedCount] = await Promise.all([
    getTags(),
    !isFanzaSite ? getAspStats().catch((error) => {
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
    isTopPage ? getSaleProducts({ limit: 8 }) : Promise.resolve([] as SaleProduct[]),
    isTopPage ? getUncategorizedProductsCount() : Promise.resolve(0),
  ]);

  const genreTags = allTags.filter(tag => tag.category !== 'site');
  const aspStats = aspStatsResult;

  // 利用可能なASP一覧（aspStatsから動的に生成、画面上部と一致させる）
  const availableAsps = aspStats.map(stat => ({
    id: stat.aspName,
    name: stat.aspName,
  }));

  // ASP別商品数をマップに変換（フィルター表示用）
  const aspProductCounts: Record<string, number> = {};
  aspStats.forEach(stat => {
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

      {/* セクションナビゲーション */}
      {isTopPage && (
        <TopPageSectionNav
          locale={locale}
          hasSaleProducts={saleProducts.length > 0}
          hasRecentlyViewed={true}
          hasRecommendations={true}
        />
      )}

      {/* トップページ上部セクション（セール、最近見た作品） */}
      {isTopPage && (
        <section className="container mx-auto px-3 sm:px-4 py-3">
          <TopPageUpperSections
            locale={locale}
            saleProducts={saleProductsForDisplay}
            pageId="home"
          />
        </section>
      )}

      {/* 女優一覧（メインコンテンツを最優先で表示） */}
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
            <SortDropdown sortBy={sortBy} theme="dark" />
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
              ...(userSetIncludeAsps.length > 0 ? { includeAsp: userSetIncludeAsps.join(',') } : {}),
              ...(userSetExcludeAsps.length > 0 ? { excludeAsp: userSetExcludeAsps.join(',') } : {}),
              ...(hasVideo ? { hasVideo: 'true' } : {}),
              ...(hasImage ? { hasImage: 'true' } : {}),
              ...(hasReview ? { hasReview: 'true' } : {}),
            }}
          />

          <PerformerGridWithComparison
            performers={actresses}
            locale={locale}
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4"
          />

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
              ...(userSetIncludeAsps.length > 0 ? { includeAsp: userSetIncludeAsps.join(',') } : {}),
              ...(userSetExcludeAsps.length > 0 ? { excludeAsp: userSetExcludeAsps.join(',') } : {}),
              ...(hasVideo ? { hasVideo: 'true' } : {}),
              ...(hasImage ? { hasImage: 'true' } : {}),
              ...(hasReview ? { hasReview: 'true' } : {}),
            }}
          />
        </div>
      </section>

      {/* トップページ下部セクション（おすすめ、トレンド等） */}
      {isTopPage && (
        <section className="container mx-auto px-3 sm:px-4 py-3">
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
        <FanzaNewReleasesSection locale={locale} />
      )}
    </div>
  );
}
