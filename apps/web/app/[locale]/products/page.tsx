import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import Pagination from '@/components/Pagination';
import ProductGridWithComparison from '@/components/ProductGridWithComparison';

import ProductListFilter from '@/components/ProductListFilter';
import ProductSortDropdown from '@/components/ProductSortDropdown';
import PerPageDropdown from '@/components/PerPageDropdown';
import Breadcrumb from '@/components/Breadcrumb';
import ActiveFiltersChips from '@/components/ActiveFiltersChips';
import { JsonLD } from '@/components/JsonLD';
import SearchSuggestionsWrapper from '@/components/SearchSuggestionsWrapper';
import { getProducts, getProductsCount, getAspStats, getPopularTags } from '@/lib/db/queries';
import { generateBaseMetadata, generateItemListSchema, generateBreadcrumbSchema } from '@/lib/seo';
import { Metadata } from 'next';
import { getServerAspFilter, isServerFanzaSite } from '@/lib/server/site-mode';
import { localizedHref } from '@adult-v/shared/i18n';
import { unstable_cache } from 'next/cache';

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
  const hasQuery = !!searchParamsData['q'];
  const hasFilters = !!(
    searchParamsData['includeAsp'] ||
    searchParamsData['excludeAsp'] ||
    searchParamsData['hasVideo'] ||
    searchParamsData['hasImage'] ||
    searchParamsData['onSale'] ||
    searchParamsData['include'] ||
    searchParamsData['exclude'] ||
    searchParamsData['performerType'] ||
    searchParamsData['uncategorized'] ||
    searchParamsData['releaseDate']
  );
  // ページネーション: 1-5ページ目は許可、6ページ目以降はnoindex
  const pageNum = Math.max(1, Math.min(parseInt(searchParamsData['page'] as string) || 1, 500));
  const hasDeepPagination = pageNum > 5;
  // ソートパラメータは許可（重複はcanonicalで制御）
  // const hasNonDefaultSort は削除 - ソート結果もインデックス可能に

  const baseUrl = process.env['NEXT_PUBLIC_SITE_URL'] || 'https://www.adult-v.com';

  const metadata = generateBaseMetadata(
    t('title'),
    t('metaDescription'),
    undefined,
    localizedHref('/products', locale),
    undefined,
    locale,
  );

  // hreflang/canonical設定（?hl=形式）
  const alternates = {
    canonical: `${baseUrl}/products`,
    languages: {
      ja: `${baseUrl}/products`,
      en: `${baseUrl}/products?hl=en`,
      zh: `${baseUrl}/products?hl=zh`,
      'zh-TW': `${baseUrl}/products?hl=zh-TW`,
      ko: `${baseUrl}/products?hl=ko`,
      'x-default': `${baseUrl}/products`,
    },
  };

  // 検索・フィルター・6ページ目以降はnoindex（重複コンテンツ防止）
  // noindex時はhreflang除去（canonicalのみ残す）
  if (hasQuery || hasFilters || hasDeepPagination) {
    return {
      ...metadata,
      alternates: { canonical: alternates.canonical },
      robots: {
        index: false,
        follow: true,
      },
    };
  }

  return { ...metadata, alternates };
}

// ISR: locale明示でheaders()回避済み → パブリックキャッシュ有効
export const revalidate = 60;

// キャッシュ付きクエリ（DB負荷軽減のため300秒TTL）
const getCachedAspStats = unstable_cache(
  async (isFanzaSite: boolean) => (isFanzaSite ? [] : getAspStats()),
  ['products-asp-stats'],
  { revalidate: 300, tags: ['products'] },
);

const getCachedPopularTags = unstable_cache(
  async (limit: number) => getPopularTags({ limit }),
  ['products-popular-tags'],
  { revalidate: 300, tags: ['products'] },
);

const getCachedProductsCount = unstable_cache(
  async (filterOptions: Parameters<typeof getProductsCount>[0]) => getProductsCount(filterOptions),
  ['products-count'],
  { revalidate: 300, tags: ['products'] },
);

const getCachedProducts = unstable_cache(
  async (options: Parameters<typeof getProducts>[0]) => getProducts(options),
  ['products-list'],
  { revalidate: 300, tags: ['products'] },
);

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const DEFAULT_PER_PAGE = 48;
const VALID_PER_PAGE = [12, 24, 48, 96];

export default async function ProductsPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const searchParamsData = await searchParams;
  const page = Math.max(1, Math.min(Number(searchParamsData['page']) || 1, 500));

  // 表示件数（URLパラメータから取得、無効な値はデフォルトに）
  const perPageParam = Number(searchParamsData['perPage']);
  const perPage = VALID_PER_PAGE.includes(perPageParam) ? perPageParam : DEFAULT_PER_PAGE;

  // 翻訳とサイト設定を並列取得（パフォーマンス最適化）
  const [tNav, t, serverAspFilter, isFanzaSite] = await Promise.all([
    getTranslations({ locale, namespace: 'nav' }),
    getTranslations({ locale, namespace: 'products' }),
    getServerAspFilter(),
    isServerFanzaSite(),
  ]);

  const query =
    typeof searchParamsData['q'] === 'string' ? searchParamsData['q'].trim().slice(0, 500) || undefined : undefined;

  // ASPフィルターの決定ロジック:
  // 1. URLパラメータが指定されている場合は、それを優先（サイト許可ASP内でフィルター）
  // 2. URLパラメータがない場合は、サイトデフォルト（FANZAサイト:FANZA, adult-v:全ASP）
  const urlIncludeAsp =
    typeof searchParamsData['includeAsp'] === 'string' ? searchParamsData['includeAsp'].split(',').filter(Boolean) : [];

  let includeAsp: string[];
  if (urlIncludeAsp.length > 0) {
    // URLパラメータが指定されている場合
    if (serverAspFilter) {
      // サイトの許可ASPリストがある場合、その中でフィルター
      includeAsp = urlIncludeAsp.filter((asp) =>
        serverAspFilter.some((allowed) => allowed.toUpperCase() === asp.toUpperCase()),
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
  includeAsp = includeAsp.map((asp) => asp.toLowerCase());

  const excludeAsp = (
    typeof searchParamsData['excludeAsp'] === 'string' ? searchParamsData['excludeAsp'].split(',').filter(Boolean) : []
  ).map((asp) => asp.toLowerCase());
  const hasVideo = searchParamsData['hasVideo'] === 'true';
  const hasImage = searchParamsData['hasImage'] === 'true';
  const onSale = searchParamsData['onSale'] === 'true';
  const uncategorized = searchParamsData['uncategorized'] === 'true';
  const performerType = searchParamsData['performerType'] as 'solo' | 'multi' | undefined;
  const releaseDate = typeof searchParamsData['releaseDate'] === 'string' ? searchParamsData['releaseDate'] : undefined;
  const includeTags =
    typeof searchParamsData['include'] === 'string' ? searchParamsData['include'].split(',').filter(Boolean) : [];
  const excludeTags =
    typeof searchParamsData['exclude'] === 'string' ? searchParamsData['exclude'].split(',').filter(Boolean) : [];
  const sortBy = typeof searchParamsData['sort'] === 'string' ? searchParamsData['sort'] : 'releaseDateDesc';
  const offset = (page - 1) * perPage;

  // フィルタオプションを共通化（exactOptionalPropertyTypes対応）
  const filterOptions = {
    ...(query && { query }),
    ...(includeAsp.length > 0 && { providers: includeAsp }),
    ...(excludeAsp.length > 0 && { excludeProviders: excludeAsp }),
    ...(hasVideo && { hasVideo: true as const }),
    ...(hasImage && { hasImage: true as const }),
    ...(onSale && { onSale: true as const }),
    ...(uncategorized && { uncategorized: true as const }),
    ...(performerType && { performerType }),
    ...(releaseDate && { releaseDate }),
    ...(includeTags.length > 0 && { tags: includeTags }),
    ...(excludeTags.length > 0 && { excludeTags }),
  };

  // ASP統計、タグ、総件数、商品を全て並列取得（unstable_cacheで300秒TTL）
  const [aspStats, popularTags, totalCount, products] = await Promise.all([
    getCachedAspStats(isFanzaSite),
    getCachedPopularTags(50),
    getCachedProductsCount(filterOptions),
    getCachedProducts({
      ...filterOptions,
      offset,
      limit: perPage,
      sortBy: sortBy as
        | 'releaseDateDesc'
        | 'releaseDateAsc'
        | 'priceDesc'
        | 'priceAsc'
        | 'ratingDesc'
        | 'reviewCountDesc'
        | 'titleAsc',
      locale,
    }),
  ]);

  // ページネーション用のクエリパラメータ
  const queryParams: Record<string, string> = {};
  if (query) queryParams['q'] = query;
  if (includeAsp.length > 0) queryParams['includeAsp'] = includeAsp.join(',');
  if (excludeAsp.length > 0) queryParams['excludeAsp'] = excludeAsp.join(',');
  if (hasVideo) queryParams['hasVideo'] = 'true';
  if (hasImage) queryParams['hasImage'] = 'true';
  if (onSale) queryParams['onSale'] = 'true';
  if (uncategorized) queryParams['uncategorized'] = 'true';
  if (performerType) queryParams['performerType'] = performerType;
  if (releaseDate) queryParams['releaseDate'] = releaseDate;
  if (includeTags.length > 0) queryParams['include'] = includeTags.join(',');
  if (excludeTags.length > 0) queryParams['exclude'] = excludeTags.join(',');
  if (sortBy !== 'releaseDateDesc') queryParams['sort'] = sortBy;
  if (perPage !== DEFAULT_PER_PAGE) queryParams['perPage'] = String(perPage);

  // ASP統計をProductListFilter用に変換
  const aspStatsForFilter = aspStats.map((stat) => ({
    aspName: stat.aspName,
    count: stat.productCount,
  }));

  // タグをProductListFilter用に変換
  const genreTagsForFilter = popularTags.map((tag) => ({
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
    t('title'),
  );

  // BreadcrumbSchemaを生成（?hl=形式のURL）
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: tNav('home'), url: localizedHref('/', locale) },
    { name: t('title'), url: basePath },
  ]);

  return (
    <div className="theme-body min-h-screen">
      {/* 構造化データ */}
      <JsonLD data={itemListSchema} />
      <JsonLD data={breadcrumbSchema} />

      <section id="products" className="scroll-mt-20 py-3 sm:py-4 md:py-6">
        <div className="container mx-auto px-3 sm:px-4">
          <Breadcrumb
            items={[{ label: tNav('home'), href: localizedHref('/', locale) }, { label: t('title') }]}
            className="mb-2 sm:mb-3"
          />

          <div className="mb-2 sm:mb-3">
            <h1 className="mb-0.5 text-xl font-bold text-white sm:text-2xl md:text-3xl">
              {query ? t('searchResultsFor', { query }) : t('title')}
            </h1>
            <p className="text-sm text-gray-300 sm:text-base">
              {t('description', { count: totalCount.toLocaleString() })}
            </p>
            {!query && <p className="mt-1 text-xs leading-relaxed text-gray-500 sm:text-sm">{t('metaDescription')}</p>}
          </div>

          {/* AI検索拡張（検索クエリがある場合のみ） */}
          {query && <SearchSuggestionsWrapper query={query} locale={locale} />}

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

          {/* 並び順・表示件数 */}
          <div className="mb-2 flex items-center justify-end gap-4 sm:mb-4">
            <PerPageDropdown perPage={perPage} basePath={basePath} />
            <ProductSortDropdown sortBy={sortBy} basePath={basePath} />
          </div>

          {products.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-lg text-gray-400">{t('noProducts')}</p>
              {(query ||
                searchParamsData['include'] ||
                searchParamsData['onSale'] ||
                searchParamsData['hasVideo'] ||
                searchParamsData['includeAsp']) && (
                <Link
                  href={localizedHref('/products', locale)}
                  className="mt-4 inline-block rounded-lg bg-fuchsia-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-fuchsia-700"
                >
                  {t('clearFilters')}
                </Link>
              )}
            </div>
          ) : (
            <>
              <Pagination
                total={totalCount}
                page={page}
                perPage={perPage}
                basePath={basePath}
                position="top"
                queryParams={queryParams}
              />

              <ProductGridWithComparison
                products={products}
                locale={locale}
                className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
              />

              <Pagination
                total={totalCount}
                page={page}
                perPage={perPage}
                basePath={basePath}
                position="bottom"
                queryParams={queryParams}
              />
            </>
          )}

          {/* 女優一覧へのリンク */}
          <div className="mt-8 border-t border-gray-800 pt-6 sm:mt-12 sm:pt-8">
            <Link
              href={localizedHref('/', locale)}
              className="group flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-4 transition-colors hover:border-fuchsia-600 hover:bg-white/10"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">👩</span>
                <div>
                  <span className="font-medium text-white">{tNav('actressList')}</span>
                  <p className="mt-0.5 text-sm text-gray-400">{t('viewActressListDesc')}</p>
                </div>
              </div>
              <svg
                className="h-5 w-5 text-gray-400 transition-colors group-hover:text-fuchsia-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
