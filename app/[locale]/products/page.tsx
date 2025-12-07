import { getTranslations } from 'next-intl/server';
import ProductCard from '@/components/ProductCard';
import Pagination from '@/components/Pagination';
import ProductListFilter from '@/components/ProductListFilter';
import ProductSortDropdown from '@/components/ProductSortDropdown';
import Breadcrumb from '@/components/Breadcrumb';
import { getProducts, getProductsCount, getAspStats } from '@/lib/db/queries';
import { generateBaseMetadata, generateItemListSchema } from '@/lib/seo';
import { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'products' });

  return generateBaseMetadata(
    t('title'),
    t('metaDescription'),
    undefined,
    `/${locale}/products`,
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

export default async function ProductsPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const tNav = await getTranslations({ locale, namespace: 'nav' });
  const t = await getTranslations({ locale, namespace: 'products' });

  const searchParamsData = await searchParams;
  const page = Number(searchParamsData.page) || 1;
  const includeAsp = typeof searchParamsData.includeAsp === 'string'
    ? searchParamsData.includeAsp.split(',').filter(Boolean)
    : [];
  const excludeAsp = typeof searchParamsData.excludeAsp === 'string'
    ? searchParamsData.excludeAsp.split(',').filter(Boolean)
    : [];
  const hasVideo = searchParamsData.hasVideo === 'true';
  const hasImage = searchParamsData.hasImage === 'true';
  const onSale = searchParamsData.onSale === 'true';
  const performerType = searchParamsData.performerType as 'solo' | 'multi' | undefined;
  const sortBy = typeof searchParamsData.sort === 'string' ? searchParamsData.sort : 'releaseDateDesc';
  const offset = (page - 1) * ITEMS_PER_PAGE;

  // フィルタオプションを共通化
  const filterOptions = {
    providers: includeAsp.length > 0 ? includeAsp : undefined,
    hasVideo: hasVideo || undefined,
    hasImage: hasImage || undefined,
    onSale: onSale || undefined,
    performerType: performerType || undefined,
  };

  // ASP統計と総件数を並列取得
  const [aspStats, totalCount] = await Promise.all([
    getAspStats(),
    getProductsCount(filterOptions),
  ]);

  // 商品を取得（offsetとlimitでページネーション）
  const products = await getProducts({
    ...filterOptions,
    offset,
    limit: ITEMS_PER_PAGE,
    sortBy: sortBy as 'releaseDateDesc' | 'releaseDateAsc' | 'priceDesc' | 'priceAsc' | 'titleAsc',
    locale,
  });

  // ページネーション用のクエリパラメータ
  const queryParams: Record<string, string> = {};
  if (includeAsp.length > 0) queryParams.includeAsp = includeAsp.join(',');
  if (excludeAsp.length > 0) queryParams.excludeAsp = excludeAsp.join(',');
  if (hasVideo) queryParams.hasVideo = 'true';
  if (hasImage) queryParams.hasImage = 'true';
  if (onSale) queryParams.onSale = 'true';
  if (performerType) queryParams.performerType = performerType;
  if (sortBy !== 'releaseDateDesc') queryParams.sort = sortBy;

  // ASP統計をProductListFilter用に変換
  const aspStatsForFilter = aspStats.map(stat => ({
    aspName: stat.aspName,
    count: stat.productCount,
  }));

  // ItemListSchemaを生成
  const itemListSchema = generateItemListSchema(
    products.map((product) => ({
      name: product.title,
      url: `/${locale}/products/${product.id}`,
    })),
    t('title')
  );

  return (
    <div className="bg-gray-900 min-h-screen">
      {/* ItemList構造化データ */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />
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

          {/* フィルター - defaultOpen=false で閉じた状態で表示 */}
          <ProductListFilter
            aspStats={aspStatsForFilter}
            showInitialFilter={false}
            showPatternFilter={false}
            showGenreFilter={false}
            showAspFilter={true}
            showSampleFilter={true}
            showPerformerTypeFilter={true}
            accentColor="rose"
            defaultOpen={false}
          />

          {/* 並び順 */}
          <div className="flex justify-end mb-4">
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
                perPage={ITEMS_PER_PAGE}
                basePath={`/${locale}/products`}
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
                basePath={`/${locale}/products`}
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
