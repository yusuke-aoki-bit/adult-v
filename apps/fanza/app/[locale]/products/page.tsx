import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Pagination } from '@adult-v/shared/components';
import ProductGridWithComparison from '@/components/ProductGridWithComparison';
import ProductListFilter from '@/components/ProductListFilter';
import ProductSortDropdown from '@/components/ProductSortDropdown';
import Breadcrumb from '@/components/Breadcrumb';
import ActiveFiltersChips from '@/components/ActiveFiltersChips';
import PageLayout from '@/components/PageLayout';
import ProductListSectionNav from '@/components/ProductListSectionNav';
import { JsonLD } from '@/components/JsonLD';
import SearchSuggestionsWrapper from '@/components/SearchSuggestionsWrapper';
import { getProducts, getProductsCount, getAspStats, getPopularTags, getUncategorizedProductsCount, getSaleProducts, SaleProduct } from '@/lib/db/queries';
import { generateBaseMetadata, generateItemListSchema, generateBreadcrumbSchema } from '@/lib/seo';
import { Metadata } from 'next';
import { getServerAspFilter, isServerFanzaSite } from '@/lib/server/site-mode';
import { localizedHref } from '@adult-v/shared/i18n';

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const searchParamsData = await searchParams;
  const t = await getTranslations({ locale, namespace: 'products' });

  // 検索クエリやフィルターがある場合はnoindex
  const hasQuery = !!searchParamsData.q;
  const hasFilters = !!(
    searchParamsData.includeAsp ||
    searchParamsData.excludeAsp ||
    searchParamsData.hasVideo ||
    searchParamsData.hasImage ||
    searchParamsData.onSale ||
    searchParamsData.include ||
    searchParamsData.exclude ||
    searchParamsData.performerType ||
    searchParamsData.uncategorized ||
    searchParamsData.releaseDate
  );
  const hasPageParam = !!searchParamsData.page && searchParamsData.page !== '1';
  // sortパラメータがデフォルト以外の場合もnoindex（重複コンテンツ防止）
  const hasNonDefaultSort = !!searchParamsData.sort && searchParamsData.sort !== 'releaseDate';

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';

  const metadata = generateBaseMetadata(
    t('title'),
    t('metaDescription'),
    undefined,
    localizedHref('/products', locale),
    undefined,
    locale,
  );

  // hreflang/canonical設定
  const alternates = {
    canonical: `${baseUrl}/products`,
    languages: {
      'ja': `${baseUrl}/products`,
      'en': `${baseUrl}/products?hl=en`,
      'zh': `${baseUrl}/products?hl=zh`,
      'zh-TW': `${baseUrl}/products?hl=zh-TW`,
      'ko': `${baseUrl}/products?hl=ko`,
      'x-default': `${baseUrl}/products`,
    },
  };

  // 検索/フィルター結果・2ページ目以降・非デフォルトソートはnoindex（重複コンテンツ防止）
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

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const PER_PAGE = 96;

export default async function ProductsPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const tNav = await getTranslations({ locale, namespace: 'nav' });
  const t = await getTranslations({ locale, namespace: 'products' });
  const tUncategorized = await getTranslations({ locale, namespace: 'uncategorized' });

  const searchParamsData = await searchParams;
  const page = Number(searchParamsData.page) || 1;

  // FANZAサイトかどうかを判定
  const [serverAspFilter, isFanzaSite] = await Promise.all([
    getServerAspFilter(),
    isServerFanzaSite(),
  ]);


  const query = typeof searchParamsData.q === 'string' ? searchParamsData.q.trim() : undefined;

  // ASPフィルターの決定ロジック:
  // 1. URLパラメータが指定されている場合は、それを優先（サイト許可ASP内でフィルター）
  // 2. URLパラメータがない場合は、サイトデフォルト（FANZAサイト:FANZA, adult-v:全ASP）
  const urlIncludeAsp = typeof searchParamsData.includeAsp === 'string'
    ? searchParamsData.includeAsp.split(',').filter(Boolean)
    : [];

  let includeAsp: string[];
  if (urlIncludeAsp.length > 0) {
    // URLパラメータが指定されている場合
    if (serverAspFilter) {
      // サイトの許可ASPリストがある場合、その中でフィルター
      includeAsp = urlIncludeAsp.filter(asp =>
        serverAspFilter.some(allowed => allowed.toUpperCase() === asp.toUpperCase())
      );
    } else {
      includeAsp = urlIncludeAsp;
    }
  } else {
    // URLパラメータがない場合はサイトデフォルト（またはなし）
    // adult-vサイトではデフォルトで全ASP表示（フィルターなし）
    includeAsp = isFanzaSite && serverAspFilter ? serverAspFilter : [];
  }
  // ASP名を小文字に正規化（DBのCASE式で小文字に変換されるため）
  includeAsp = includeAsp.map(asp => asp.toLowerCase());

  const excludeAsp = (typeof searchParamsData.excludeAsp === 'string'
    ? searchParamsData.excludeAsp.split(',').filter(Boolean)
    : []).map(asp => asp.toLowerCase());
  const hasVideo = searchParamsData.hasVideo === 'true';
  const hasImage = searchParamsData.hasImage === 'true';
  const onSale = searchParamsData.onSale === 'true';
  const uncategorized = searchParamsData.uncategorized === 'true';
  const performerType = searchParamsData.performerType as 'solo' | 'multi' | undefined;
  const releaseDate = typeof searchParamsData.releaseDate === 'string' ? searchParamsData.releaseDate : undefined;
  const includeTags = typeof searchParamsData.include === 'string'
    ? searchParamsData.include.split(',').filter(Boolean)
    : [];
  const excludeTags = typeof searchParamsData.exclude === 'string'
    ? searchParamsData.exclude.split(',').filter(Boolean)
    : [];
  const sortBy = typeof searchParamsData.sort === 'string' ? searchParamsData.sort : 'releaseDateDesc';
  const offset = (page - 1) * PER_PAGE;

  // フィルタオプションを共通化
  const filterOptions = {
    query: query || undefined,
    providers: includeAsp.length > 0 ? includeAsp : undefined,
    excludeProviders: excludeAsp.length > 0 ? excludeAsp : undefined,
    hasVideo: hasVideo || undefined,
    hasImage: hasImage || undefined,
    onSale: onSale || undefined,
    uncategorized: uncategorized || undefined,
    performerType: performerType || undefined,
    releaseDate: releaseDate || undefined,
    tags: includeTags.length > 0 ? includeTags : undefined,
    excludeTags: excludeTags.length > 0 ? excludeTags : undefined,
  };

  // TOPページ（フィルターなし、1ページ目）かどうかを判定
  const userSetIncludeAsps = isFanzaSite ? [] : includeAsp;
  const userSetExcludeAsps = isFanzaSite ? [] : excludeAsp;
  const isTopPage = !query && userSetIncludeAsps.length === 0 && userSetExcludeAsps.length === 0 && !hasVideo && !hasImage && !onSale && !uncategorized && !performerType && !releaseDate && includeTags.length === 0 && excludeTags.length === 0 && sortBy === 'releaseDateDesc' && page === 1;

  // ASP統計、タグ、総件数、商品を全て並列取得（パフォーマンス最適化）
  const [aspStats, popularTags, totalCount, products] = await Promise.all([
    isFanzaSite ? Promise.resolve([]) : getAspStats(),
    getPopularTags({ limit: 50 }),
    getProductsCount(filterOptions),
    getProducts({
      ...filterOptions,
      offset,
      limit: PER_PAGE,
      sortBy: sortBy as 'releaseDateDesc' | 'releaseDateAsc' | 'priceDesc' | 'priceAsc' | 'ratingDesc' | 'reviewCountDesc' | 'titleAsc',
      locale,
    }),
  ]);

  // セール情報と未整理商品数を取得（TOPページのみ）
  let saleProducts: SaleProduct[] = [];
  let uncategorizedCount = 0;

  if (isTopPage) {
    try {
      const [sales, uncatCount] = await Promise.all([
        getSaleProducts({
          limit: 24,
          minDiscount: 30,
          aspName: 'FANZA', // FANZAサイトなのでFANZAのみ
        }),
        getUncategorizedProductsCount({
          includeAsp: ['FANZA'],
        }),
      ]);
      saleProducts = sales;
      uncategorizedCount = uncatCount;
    } catch (error) {
      console.error('Failed to fetch homepage sections:', error);
    }
  }

  // ページネーション用のクエリパラメータ
  // FANZAサイトではASPフィルターは自動適用されるためURLに含めない
  const queryParams: Record<string, string> = {};
  if (query) queryParams.q = query;
  if (!isFanzaSite && includeAsp.length > 0) queryParams.includeAsp = includeAsp.join(',');
  if (!isFanzaSite && excludeAsp.length > 0) queryParams.excludeAsp = excludeAsp.join(',');
  if (hasVideo) queryParams.hasVideo = 'true';
  if (hasImage) queryParams.hasImage = 'true';
  if (onSale) queryParams.onSale = 'true';
  if (uncategorized) queryParams.uncategorized = 'true';
  if (performerType) queryParams.performerType = performerType;
  if (releaseDate) queryParams.releaseDate = releaseDate;
  if (includeTags.length > 0) queryParams.include = includeTags.join(',');
  if (excludeTags.length > 0) queryParams.exclude = excludeTags.join(',');
  if (sortBy !== 'releaseDateDesc') queryParams.sort = sortBy;

  // ASP統計をProductListFilter用に変換
  const aspStatsForFilter = aspStats.map(stat => ({
    aspName: stat.aspName,
    count: stat.productCount,
  }));

  // タグをProductListFilter用に変換
  const genreTagsForFilter = popularTags.map(tag => ({
    id: tag.id,
    name: tag.name,
    count: tag.count,
  }));

  // basePath（?hl=形式）
  const basePath = localizedHref('/products', locale);

  // ItemListSchemaを生成（?hl=形式のURL）
  const itemListSchema = generateItemListSchema(
    products.map((product) => ({
      name: product.title,
      url: localizedHref(`/products/${product.id}`, locale),
    })),
    t('title')
  );

  // BreadcrumbSchemaを生成（?hl=形式のURL）
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: tNav('home'), url: localizedHref('/', locale) },
    { name: t('title'), url: basePath },
  ]);

  // PageLayout用の翻訳
  const layoutTranslations = {
    viewProductList: t('title'),
    viewProductListDesc: t('viewActressListDesc'),
    uncategorizedBadge: tUncategorized('badge'),
    uncategorizedDescription: tUncategorized('shortDescription'),
    uncategorizedCount: tUncategorized('itemCount', { count: uncategorizedCount.toLocaleString() }),
  };

  return (
    <PageLayout
      locale={locale}
      saleProducts={saleProducts.map(p => ({
        ...p,
        endAt: p.endAt ? p.endAt.toISOString() : null,
      }))}
      uncategorizedCount={uncategorizedCount}
      isTopPage={false}
      translations={layoutTranslations}
    >
      {/* セクションナビゲーション */}
      <ProductListSectionNav locale={locale} hasSaleProducts={saleProducts.length > 0} />

      {/* 構造化データ */}
      <JsonLD data={itemListSchema} />
      <JsonLD data={breadcrumbSchema} />

      <section id="products" className="py-3 sm:py-4 md:py-6 scroll-mt-20">
        <div className="container mx-auto px-3 sm:px-4">
          <Breadcrumb
            items={[
              { label: tNav('home'), href: localizedHref('/', locale) },
              { label: t('title') },
            ]}
            className="mb-2 sm:mb-3"
          />

          <div className="mb-2 sm:mb-3">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold theme-text mb-0.5">
              {query ? `「${query}」の検索結果` : t('title')}
            </h1>
            <p className="text-sm sm:text-base theme-text-secondary">
              {t('description', { count: totalCount.toLocaleString() })}
            </p>
          </div>

          {/* AI検索拡張（検索クエリがある場合のみ） */}
          {query && (
            <SearchSuggestionsWrapper query={query} locale={locale} />
          )}

          {/* アクティブフィルターチップ */}
          <ActiveFiltersChips />

          {/* フィルター - defaultOpen=false で閉じた状態で表示 */}
          <ProductListFilter
            aspStats={aspStatsForFilter}
            genreTags={genreTagsForFilter}
            showInitialFilter={false}
            showPatternFilter={false}
            showGenreFilter={true}
            showAspFilter={true}
            showSampleFilter={true}
            showPerformerTypeFilter={true}
            showUncategorizedFilter={true}
            accentColor="rose"
            defaultOpen={false}
          />

          {/* 並び順 */}
          <div className="flex justify-end mb-2 sm:mb-4">
            <ProductSortDropdown
              sortBy={sortBy}
              basePath={basePath}
            />
          </div>

          {products.length === 0 ? (
            <div className="text-center py-16">
              <p className="theme-text-muted text-lg">{t('noProducts')}</p>
            </div>
          ) : (
            <>
              {/* ページネーション（上部） */}
              <Pagination
                total={totalCount}
                page={page}
                perPage={PER_PAGE}
                basePath={basePath}
                position="top"
                queryParams={queryParams}
              />

              <ProductGridWithComparison
                products={products}
                locale={locale}
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
              />

              {/* ページネーション（下部） */}
              <Pagination
                total={totalCount}
                page={page}
                perPage={PER_PAGE}
                basePath={basePath}
                position="bottom"
                queryParams={queryParams}
              />
            </>
          )}

          {/* 女優一覧へのリンク */}
          <div className="mt-8 sm:mt-12 pt-6 sm:pt-8 border-t theme-section-border">
            <Link
              href={localizedHref('/', locale)}
              className="flex items-center justify-between p-4 theme-content hover:opacity-90 rounded-lg border theme-border hover:border-rose-600 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">👩</span>
                <div>
                  <span className="theme-text font-medium">{tNav('actressList')}</span>
                  <p className="theme-text-muted text-sm mt-0.5">{t('viewActressListDesc')}</p>
                </div>
              </div>
              <svg className="w-5 h-5 theme-text-muted group-hover:text-rose-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
