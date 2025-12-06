import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import ProductCard from '@/components/ProductCard';
import Pagination from '@/components/Pagination';
import Breadcrumb from '@/components/Breadcrumb';
import { JsonLD } from '@/components/JsonLD';
import ProductListFilter from '@/components/ProductListFilter';
import { getTagById, getProductsByCategory, getProductCountByCategory, getAspStatsByCategory } from '@/lib/db/queries';
import { generateBaseMetadata } from '@/lib/seo';
import { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; tagId: string }>;
}): Promise<Metadata> {
  const { locale, tagId } = await params;
  const tag = await getTagById(parseInt(tagId));

  if (!tag) return {};

  return generateBaseMetadata(
    `${tag.name}の作品一覧 | ${tag.name}ジャンルの動画を検索`,
    `${tag.name}ジャンルのアダルト動画一覧。複数配信サイト(DMM, MGS, DUGA等)から${tag.name}作品を横断検索。高画質サンプル画像と詳細情報付き。`,
    undefined,
    `/${locale}/categories/${tagId}`,
    undefined,
    locale,
  );
}

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string; tagId: string }>;
  searchParams: Promise<{
    page?: string;
    initial?: string;
    includeAsp?: string;
    excludeAsp?: string;
    hasVideo?: string;
    hasImage?: string;
    performerType?: string;
  }>;
}

const ITEMS_PER_PAGE = 50;

export default async function CategoryDetailPage({ params, searchParams }: PageProps) {
  const { locale, tagId } = await params;
  const resolvedSearchParams = await searchParams;
  const tNav = await getTranslations({ locale, namespace: 'nav' });

  const tag = await getTagById(parseInt(tagId));
  if (!tag) notFound();

  const page = parseInt(resolvedSearchParams.page || '1', 10);
  const offset = (page - 1) * ITEMS_PER_PAGE;

  // フィルターパラメータを取得
  const initial = resolvedSearchParams.initial || '';
  const includeAsp = resolvedSearchParams.includeAsp?.split(',').filter(Boolean) || [];
  const excludeAsp = resolvedSearchParams.excludeAsp?.split(',').filter(Boolean) || [];
  const hasVideo = resolvedSearchParams.hasVideo === 'true';
  const hasImage = resolvedSearchParams.hasImage === 'true';
  const performerType = resolvedSearchParams.performerType as 'solo' | 'multi' | undefined;

  const filterOptions = {
    initial: initial || undefined,
    includeAsp: includeAsp.length > 0 ? includeAsp : undefined,
    excludeAsp: excludeAsp.length > 0 ? excludeAsp : undefined,
    hasVideo: hasVideo || undefined,
    hasImage: hasImage || undefined,
    performerType: performerType || undefined,
  };

  const [products, totalCount, aspStats] = await Promise.all([
    getProductsByCategory(tag.id, { limit: ITEMS_PER_PAGE, offset, ...filterOptions }),
    getProductCountByCategory(tag.id, filterOptions),
    getAspStatsByCategory(tag.id),
  ]);

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: tNav('home'),
        item: `${process.env.NEXT_PUBLIC_SITE_URL}/${locale}`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'カテゴリ',
        item: `${process.env.NEXT_PUBLIC_SITE_URL}/${locale}/categories`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: tag.name,
        item: `${process.env.NEXT_PUBLIC_SITE_URL}/${locale}/categories/${tag.id}`,
      },
    ],
  };

  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${tag.name}の作品一覧`,
    numberOfItems: totalCount,
    itemListElement: products.slice(0, 20).map((product, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: product.title,
      url: `${process.env.NEXT_PUBLIC_SITE_URL}/${locale}/product/${product.id}`,
    })),
  };

  const basePath = `/${locale}/categories/${tag.id}`;

  // Paginationに渡すqueryParams
  const queryParams: Record<string, string> = {};
  if (initial) queryParams.initial = initial;
  if (includeAsp.length > 0) queryParams.includeAsp = includeAsp.join(',');
  if (excludeAsp.length > 0) queryParams.excludeAsp = excludeAsp.join(',');
  if (hasVideo) queryParams.hasVideo = 'true';
  if (hasImage) queryParams.hasImage = 'true';
  if (performerType) queryParams.performerType = performerType;

  return (
    <>
      <JsonLD data={breadcrumbSchema} />
      <JsonLD data={itemListSchema} />

      <div className="bg-gray-900 min-h-screen">
        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4">
            <Breadcrumb
              items={[
                { label: tNav('home'), href: `/${locale}` },
                { label: 'カテゴリ', href: `/${locale}/categories` },
                { label: tag.name },
              ]}
              className="mb-6"
            />

            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <span className="px-3 py-1 bg-purple-600 text-white text-sm font-semibold rounded-full">
                  ジャンル
                </span>
                <h1 className="text-3xl md:text-4xl font-bold text-white">
                  {tag.name}
                </h1>
              </div>
              <p className="text-gray-300">
                {tag.name}ジャンルの作品{totalCount.toLocaleString()}件を掲載。
                新着順に並んでいます。
              </p>
            </div>

            {/* フィルター */}
            <ProductListFilter
              aspStats={aspStats}
              showInitialFilter={true}
              showPatternFilter={false}
              showGenreFilter={false}
              showAspFilter={true}
              showSampleFilter={true}
              showPerformerTypeFilter={true}
              accentColor="blue"
            />

            {products.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-gray-400 text-lg">該当する作品が見つかりませんでした</p>
                <Link
                  href={`/${locale}/categories`}
                  className="inline-block mt-4 text-purple-400 hover:text-purple-300"
                >
                  カテゴリ一覧に戻る
                </Link>
              </div>
            ) : (
              <>
                <Pagination
                  total={totalCount}
                  page={page}
                  perPage={ITEMS_PER_PAGE}
                  basePath={basePath}
                  position="top"
                  queryParams={queryParams}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>

                <Pagination
                  total={totalCount}
                  page={page}
                  perPage={ITEMS_PER_PAGE}
                  basePath={basePath}
                  position="bottom"
                  queryParams={queryParams}
                />
              </>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
