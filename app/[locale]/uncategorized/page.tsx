import { getTranslations } from 'next-intl/server';
import ProductCard from '@/components/ProductCard';
import Pagination from '@/components/Pagination';
import ProductListFilter from '@/components/ProductListFilter';
import ProductSortDropdown from '@/components/ProductSortDropdown';
import Breadcrumb from '@/components/Breadcrumb';
import { getUncategorizedProducts, getUncategorizedProductsCount, getUncategorizedStats } from '@/lib/db/queries';
import { generateBaseMetadata } from '@/lib/seo';
import { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'uncategorized' });

  return generateBaseMetadata(
    t('title'),
    t('metaDescription'),
    undefined,
    `/${locale}/uncategorized`,
    undefined,
    locale,
  );
}

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const ITEMS_PER_PAGE = 50;

export default async function UncategorizedPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const tNav = await getTranslations({ locale, namespace: 'nav' });
  const t = await getTranslations({ locale, namespace: 'uncategorized' });

  const searchParamsData = await searchParams;
  const page = Number(searchParamsData.page) || 1;
  const pattern = typeof searchParamsData.pattern === 'string' ? searchParamsData.pattern : '';
  const initial = typeof searchParamsData.initial === 'string' ? searchParamsData.initial : '';
  const includeAsp = typeof searchParamsData.includeAsp === 'string'
    ? searchParamsData.includeAsp.split(',').filter(Boolean)
    : [];
  const excludeAsp = typeof searchParamsData.excludeAsp === 'string'
    ? searchParamsData.excludeAsp.split(',').filter(Boolean)
    : [];
  const hasVideo = searchParamsData.hasVideo === 'true';
  const hasImage = searchParamsData.hasImage === 'true';
  const sortBy = typeof searchParamsData.sort === 'string' ? searchParamsData.sort : 'releaseDateDesc';
  const offset = (page - 1) * ITEMS_PER_PAGE;

  const filterOptions = {
    pattern,
    initial,
    includeAsp,
    excludeAsp,
    hasVideo,
    hasImage,
    sortBy,
  };

  const [products, totalCount, stats] = await Promise.all([
    getUncategorizedProducts({ limit: ITEMS_PER_PAGE, offset, ...filterOptions, locale }),
    getUncategorizedProductsCount(filterOptions),
    getUncategorizedStats(),
  ]);

  // ページネーション用のクエリパラメータ
  const queryParams: Record<string, string> = {};
  if (pattern) queryParams.pattern = pattern;
  if (initial) queryParams.initial = initial;
  if (includeAsp.length > 0) queryParams.includeAsp = includeAsp.join(',');
  if (excludeAsp.length > 0) queryParams.excludeAsp = excludeAsp.join(',');
  if (hasVideo) queryParams.hasVideo = 'true';
  if (hasImage) queryParams.hasImage = 'true';
  if (sortBy !== 'releaseDateDesc') queryParams.sort = sortBy;

  return (
    <div className="bg-gray-900 min-h-screen">
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <Breadcrumb
            items={[
              { label: tNav('home'), href: `/${locale}` },
              { label: t('title') },
            ]}
            className="mb-6"
          />

          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
              {t('title')}
            </h1>
            <p className="text-gray-300">
              {t('description', { count: totalCount.toLocaleString() })}
            </p>
          </div>

          {/* フィルター */}
          <ProductListFilter
            patternStats={stats.patternStats}
            aspStats={stats.aspStats}
            showInitialFilter={true}
            showPatternFilter={true}
            showGenreFilter={false}
            showAspFilter={true}
            showSampleFilter={true}
            accentColor="yellow"
          />

          {/* 並び順 */}
          <div className="flex justify-end mb-4">
            <ProductSortDropdown
              sortBy={sortBy}
              basePath={`/${locale}/uncategorized`}
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
                perPage={ITEMS_PER_PAGE}
                basePath={`/${locale}/uncategorized`}
                position="top"
                queryParams={queryParams}
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
                perPage={ITEMS_PER_PAGE}
                basePath={`/${locale}/uncategorized`}
                position="bottom"
                queryParams={queryParams}
              />
            </>
          )}
        </div>
      </section>
    </div>
  );
}
