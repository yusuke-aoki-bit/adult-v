import { getTranslations } from 'next-intl/server';
import SortDropdown from '@/components/SortDropdown';
import { Pagination } from '@adult-v/shared/components';
import PerformerGridWithComparison from '@/components/PerformerGridWithComparison';
import ActressListFilter from '@/components/ActressListFilter';
import { TopPageUpperSections, TopPageLowerSections } from '@/components/TopPageSections';
import TopPageSectionNav from '@/components/TopPageSectionNav';
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
  const hasQuery = !!searchParamsData['q'];
  const hasFilters = !!(
    searchParamsData['initial'] ||
    searchParamsData['include'] ||
    searchParamsData['exclude'] ||
    searchParamsData['includeAsp'] ||
    searchParamsData['excludeAsp'] ||
    searchParamsData['hasVideo'] ||
    searchParamsData['hasImage'] ||
    searchParamsData['hasReview']
  );
  const hasPageParam = !!searchParamsData['page'] && searchParamsData['page'] !== '1';
  // sortパラメータがデフォルト以外の場合もnoindex（重複コンテンツ防止）
  const hasNonDefaultSort = !!searchParamsData['sort'] && searchParamsData['sort'] !== 'releaseCount';

  const baseUrl = process.env['NEXT_PUBLIC_SITE_URL'] || 'https://example.com';

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

// Force dynamic rendering to avoid DYNAMIC_SERVER_USAGE errors with getTranslations
export const dynamic = 'force-dynamic';

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
  const page = Number(searchParamsData['page']) || 1;

  // FANZAサイトかどうかを判定
  const [serverAspFilter, isFanzaSite] = await Promise.all([
    getServerAspFilter(),
    isServerFanzaSite(),
  ]);


  const query = typeof searchParamsData['q'] === 'string' ? searchParamsData['q'] : undefined;
  const sortBy = (typeof searchParamsData['sort'] === 'string' ? searchParamsData['sort'] : 'recent') as 'nameAsc' | 'nameDesc' | 'productCountDesc' | 'productCountAsc' | 'recent';
  const initialFilter = typeof searchParamsData['initial'] === 'string' ? searchParamsData['initial'] : undefined;

  // 対象タグ（include）と除外タグ（exclude）を取得
  const includeTags = typeof searchParamsData['include'] === 'string'
    ? searchParamsData['include'].split(',').filter(Boolean)
    : Array.isArray(searchParamsData['include'])
    ? searchParamsData['include']
    : [];
  const excludeTags = typeof searchParamsData['exclude'] === 'string'
    ? searchParamsData['exclude'].split(',').filter(Boolean)
    : Array.isArray(searchParamsData['exclude'])
    ? searchParamsData['exclude']
    : [];

  // ASPフィルターを取得（FANZAサイトの場合は自動的にFANZAのみをフィルタ）
  const includeAsps = serverAspFilter
    ? serverAspFilter
    : (typeof searchParamsData['includeAsp'] === 'string'
        ? searchParamsData['includeAsp'].split(',').filter(Boolean)
        : Array.isArray(searchParamsData['includeAsp'])
        ? searchParamsData['includeAsp']
        : []);
  const excludeAsps = typeof searchParamsData['excludeAsp'] === 'string'
    ? searchParamsData['excludeAsp'].split(',').filter(Boolean)
    : Array.isArray(searchParamsData['excludeAsp'])
    ? searchParamsData['excludeAsp']
    : [];

  // hasVideo/hasImage/hasReviewフィルターを取得
  const hasVideo = searchParamsData['hasVideo'] === 'true';
  const hasImage = searchParamsData['hasImage'] === 'true';
  const hasReview = searchParamsData['hasReview'] === 'true';

  // 女優特徴フィルターを取得
  const cupSizes = typeof searchParamsData['cup'] === 'string'
    ? searchParamsData['cup'].split(',').filter(Boolean)
    : [];
  const heightMin = typeof searchParamsData['heightMin'] === 'string' && searchParamsData['heightMin']
    ? parseInt(searchParamsData['heightMin'])
    : undefined;
  const heightMax = typeof searchParamsData['heightMax'] === 'string' && searchParamsData['heightMax']
    ? parseInt(searchParamsData['heightMax'])
    : undefined;
  const bloodTypes = typeof searchParamsData['bloodType'] === 'string'
    ? searchParamsData['bloodType'].split(',').filter(Boolean)
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
    ...(searchQuery ? { query: searchQuery } : {}),
    includeTags,
    excludeTags,
    sortBy,
    excludeInitials: isEtcFilter,
    includeAsps,
    excludeAsps,
    ...(hasVideo ? { hasVideo: true as const } : {}),
    ...(hasImage ? { hasImage: true as const } : {}),
    ...(hasReview ? { hasReview: true as const } : {}),
    ...(cupSizes.length > 0 ? { cupSizes } : {}),
    ...(heightMin !== undefined ? { heightMin } : {}),
    ...(heightMax !== undefined ? { heightMax } : {}),
    ...(bloodTypes.length > 0 ? { bloodTypes } : {}),
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
          ...(isFanzaSite ? { aspName: 'FANZA' } : {}), // FANZAサイトの場合はFANZAのみ
        }),
        getUncategorizedProductsCount({
          ...(isFanzaSite ? { includeAsp: ['FANZA'] } : {}),
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
  const firstActress = actresses[0];
  const firstActressImageUrl = firstActress
    ? normalizeImageUrlForPreload(firstActress.thumbnail || firstActress.heroImage)
    : null;

  return (
    <div className="theme-body min-h-screen">
      {/* セクションナビゲーション（トップページのみ） */}
      {isTopPage && (
        <TopPageSectionNav
          locale={locale}
          hasSaleProducts={saleProducts.length > 0}
          hasRecentlyViewed={true}
          hasRecommendations={true}
        />
      )}

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

      {/* 上部セクション（セール中・最近見た作品）- 女優一覧の前 */}
      {isTopPage && (
        <section id="sale" className="py-3 sm:py-4 scroll-mt-20">
          <div className="container mx-auto px-3 sm:px-4">
            <TopPageUpperSections
              locale={locale}
              saleProducts={saleProducts.map(p => ({
                ...p,
                endAt: p.endAt ? p.endAt.toISOString() : null,
              }))}
              pageId="home"
            />
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
        </div>
      </section>

      {/* === 以下はメインコンテンツ（女優一覧）の後に表示 === */}
      {/* 下部セクション（おすすめ・注目・トレンド・リンク） */}
      <section id="recommendations" className="py-3 sm:py-4 scroll-mt-20">
        <div className="container mx-auto px-3 sm:px-4">
          <TopPageLowerSections
            locale={locale}
            uncategorizedCount={uncategorizedCount}
            isTopPage={isTopPage}
            translations={{
              viewProductList: t('viewProductList'),
              viewProductListDesc: t('viewProductListDesc'),
              uncategorizedBadge: tUncategorized('badge'),
              uncategorizedDescription: tUncategorized('shortDescription'),
              uncategorizedCount: tUncategorized('itemCount', { count: uncategorizedCount.toLocaleString() }),
            }}
            pageId="home"
          />
        </div>
      </section>
    </div>
  );
}
