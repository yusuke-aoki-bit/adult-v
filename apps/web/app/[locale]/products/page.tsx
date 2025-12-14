import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import ProductCard from '@/components/ProductCard';
import Pagination from '@/components/Pagination';
import ProductListFilter from '@/components/ProductListFilter';
import ProductSortDropdown from '@/components/ProductSortDropdown';
import Breadcrumb from '@/components/Breadcrumb';
import ActiveFiltersChips from '@/components/ActiveFiltersChips';
import { JsonLD } from '@/components/JsonLD';
import { getProducts, getProductsCount, getAspStats, getPopularTags } from '@/lib/db/queries';
import { generateBaseMetadata, generateItemListSchema, generateBreadcrumbSchema } from '@/lib/seo';
import { Metadata } from 'next';
import { getServerAspFilter, isServerFanzaSite } from '@/lib/server/site-mode';

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
    searchParamsData.uncategorized
  );
  const hasPageParam = !!searchParamsData.page && searchParamsData.page !== '1';

  const metadata = generateBaseMetadata(
    t('title'),
    t('metaDescription'),
    undefined,
    `/${locale}/products`,
    undefined,
    locale,
  );

  // 検索/フィルター結果・2ページ目以降はnoindex（重複コンテンツ防止）
  if (hasQuery || hasFilters || hasPageParam) {
    return {
      ...metadata,
      robots: {
        index: false,
        follow: true,
      },
    };
  }

  return metadata;
}

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const DEFAULT_ITEMS_PER_PAGE = 50;
const ALLOWED_PER_PAGE = [12, 24, 48, 96];

export default async function ProductsPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const tNav = await getTranslations({ locale, namespace: 'nav' });
  const t = await getTranslations({ locale, namespace: 'products' });

  const searchParamsData = await searchParams;
  const page = Number(searchParamsData.page) || 1;

  // FANZAサイトかどうかを判定
  const [serverAspFilter, isFanzaSite] = await Promise.all([
    getServerAspFilter(),
    isServerFanzaSite(),
  ]);

  // 表示件数（URLパラメータから取得、許可リストでバリデーション）
  const requestedLimit = Number(searchParamsData.limit) || DEFAULT_ITEMS_PER_PAGE;
  const itemsPerPage = ALLOWED_PER_PAGE.includes(requestedLimit) ? requestedLimit : DEFAULT_ITEMS_PER_PAGE;

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
  const excludeAsp = typeof searchParamsData.excludeAsp === 'string'
    ? searchParamsData.excludeAsp.split(',').filter(Boolean)
    : [];
  const hasVideo = searchParamsData.hasVideo === 'true';
  const hasImage = searchParamsData.hasImage === 'true';
  const onSale = searchParamsData.onSale === 'true';
  const uncategorized = searchParamsData.uncategorized === 'true';
  const performerType = searchParamsData.performerType as 'solo' | 'multi' | undefined;
  const includeTags = typeof searchParamsData.include === 'string'
    ? searchParamsData.include.split(',').filter(Boolean)
    : [];
  const excludeTags = typeof searchParamsData.exclude === 'string'
    ? searchParamsData.exclude.split(',').filter(Boolean)
    : [];
  const sortBy = typeof searchParamsData.sort === 'string' ? searchParamsData.sort : 'releaseDateDesc';
  const offset = (page - 1) * itemsPerPage;

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
    tags: includeTags.length > 0 ? includeTags : undefined,
    excludeTags: excludeTags.length > 0 ? excludeTags : undefined,
  };

  // ASP統計、タグ、総件数を並列取得（FANZAサイトではASP統計は不要）
  const [aspStats, popularTags, totalCount] = await Promise.all([
    isFanzaSite ? Promise.resolve([]) : getAspStats(),
    getPopularTags({ limit: 50 }),
    getProductsCount(filterOptions),
  ]);

  // 商品を取得（offsetとlimitでページネーション）
  const products = await getProducts({
    ...filterOptions,
    offset,
    limit: itemsPerPage,
    sortBy: sortBy as 'releaseDateDesc' | 'releaseDateAsc' | 'priceDesc' | 'priceAsc' | 'titleAsc',
    locale,
  });

  // ページネーション用のクエリパラメータ
  const queryParams: Record<string, string> = {};
  if (query) queryParams.q = query;
  if (includeAsp.length > 0) queryParams.includeAsp = includeAsp.join(',');
  if (excludeAsp.length > 0) queryParams.excludeAsp = excludeAsp.join(',');
  if (hasVideo) queryParams.hasVideo = 'true';
  if (hasImage) queryParams.hasImage = 'true';
  if (onSale) queryParams.onSale = 'true';
  if (uncategorized) queryParams.uncategorized = 'true';
  if (performerType) queryParams.performerType = performerType;
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

  // ItemListSchemaを生成
  const itemListSchema = generateItemListSchema(
    products.map((product) => ({
      name: product.title,
      url: `/${locale}/products/${product.id}`,
    })),
    t('title')
  );

  // BreadcrumbSchemaを生成
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: tNav('home'), url: `/${locale}` },
    { name: t('title'), url: `/${locale}/products` },
  ]);

  return (
    <div className="theme-body min-h-screen">
      {/* 構造化データ */}
      <JsonLD data={itemListSchema} />
      <JsonLD data={breadcrumbSchema} />
      <section className="py-3 sm:py-4 md:py-6">
        <div className="container mx-auto px-3 sm:px-4">
          <Breadcrumb
            items={[
              { label: tNav('home'), href: `/${locale}` },
              { label: t('title') },
            ]}
            className="mb-2 sm:mb-3"
          />

          <div className="mb-2 sm:mb-3">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-0.5">
              {query ? `「${query}」の検索結果` : t('title')}
            </h1>
            <p className="text-sm sm:text-base text-gray-300">
              {t('description', { count: totalCount.toLocaleString() })}
            </p>
          </div>

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
              basePath={`/${locale}/products`}
            />
          </div>

          {products.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-400 text-lg">{t('noProducts')}</p>
            </div>
          ) : (
            <>
              {/* ページネーション（上部） */}
              <Pagination
                total={totalCount}
                page={page}
                perPage={itemsPerPage}
                basePath={`/${locale}/products`}
                position="top"
                queryParams={queryParams}
                showPerPageSelector
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              {/* ページネーション（下部） */}
              <Pagination
                total={totalCount}
                page={page}
                perPage={itemsPerPage}
                basePath={`/${locale}/products`}
                position="bottom"
                queryParams={queryParams}
                showPerPageSelector
              />
            </>
          )}

          {/* 女優一覧へのリンク */}
          <div className="mt-8 sm:mt-12 pt-6 sm:pt-8 border-t border-gray-800">
            <Link
              href={`/${locale}`}
              className="flex items-center justify-between p-4 bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 hover:border-rose-600 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">👩</span>
                <div>
                  <span className="text-white font-medium">{tNav('actressList')}</span>
                  <p className="text-gray-400 text-sm mt-0.5">{t('viewActressListDesc')}</p>
                </div>
              </div>
              <svg className="w-5 h-5 text-gray-400 group-hover:text-rose-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
