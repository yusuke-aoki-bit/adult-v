import { notFound } from 'next/navigation';
import Image from 'next/image';
import ProductCard from '@/components/ProductCard';
import Pagination from '@/components/Pagination';
import { JsonLD } from '@/components/JsonLD';
import Breadcrumb from '@/components/Breadcrumb';
import { getActressById, getProducts, getTagsForActress, getPerformerAliases, getActressProductCountByAsp } from '@/lib/db/queries';
import {
  generateBaseMetadata,
  generatePersonSchema,
  generateBreadcrumbSchema,
  generateItemListSchema,
} from '@/lib/seo';
import { Metadata } from 'next';
import Link from 'next/link';
import ProductSortDropdown from '@/components/ProductSortDropdown';
import { getTranslations } from 'next-intl/server';
import { ProviderId, providerMeta } from '@/lib/providers';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ performerId: string; locale: string }>;
  searchParams: Promise<{
    page?: string;
    sort?: string;
    include?: string | string[];
    exclude?: string | string[];
  }>;
}

const PER_PAGE = 24;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const { performerId, locale } = await params;
    const actress = await getActressById(performerId);
    if (!actress) return {};

    const t = await getTranslations('actress');
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';

    return generateBaseMetadata(
      `${actress.name}の出演作品一覧 - ${actress.metrics.releaseCount}作品 | Adult Viewer Lab`,
      t('metaDescription', { name: actress.name, count: actress.metrics.releaseCount }),
      actress.heroImage || actress.thumbnail,
      `/${locale}/actress/${actress.id}`,
      undefined,
      locale,
    );
  } catch {
    return {};
  }
}

export default async function ActressDetailPage({ params, searchParams }: PageProps) {
  const { performerId, locale } = await params;
  const resolvedSearchParams = await searchParams;
  const t = await getTranslations('actress');
  const tc = await getTranslations('common');
  const tf = await getTranslations('filter');
  const tNav = await getTranslations('nav');

  const decodedId = decodeURIComponent(performerId);
  let actress = await getActressById(decodedId);
  if (!actress) actress = await getActressById(performerId);
  if (!actress) notFound();

  const page = parseInt(resolvedSearchParams.page || '1', 10);
  const sortBy = (resolvedSearchParams.sort || 'releaseDateDesc') as 'releaseDateDesc' | 'releaseDateAsc' | 'priceDesc' | 'priceAsc' | 'titleAsc';

  // Get include and exclude tags
  const includeTags = typeof resolvedSearchParams.include === 'string'
    ? resolvedSearchParams.include.split(',').filter(Boolean)
    : Array.isArray(resolvedSearchParams.include)
    ? resolvedSearchParams.include
    : [];
  const excludeTags = typeof resolvedSearchParams.exclude === 'string'
    ? resolvedSearchParams.exclude.split(',').filter(Boolean)
    : Array.isArray(resolvedSearchParams.exclude)
    ? resolvedSearchParams.exclude
    : [];

  // Get tags for the actress
  const genreTags = await getTagsForActress(actress.id, 'genre');
  const siteTags = await getTagsForActress(actress.id, 'site');

  // Get aliases for the actress
  const aliases = await getPerformerAliases(parseInt(actress.id));
  const nonPrimaryAliases = aliases.filter(alias => !alias.isPrimary);

  // Get product count by ASP
  const productCountByAsp = await getActressProductCountByAsp(actress.id);

  // ASP名をProviderId型に変換するマッピング
  const aspToProviderId: Record<string, ProviderId> = {
    'DUGA': 'duga',
    'duga': 'duga',
    'Sokmil': 'sokmil',
    'sokmil': 'sokmil',
    'MGS': 'mgs',
    'mgs': 'mgs',
    'b10f': 'b10f',
    'B10F': 'b10f',
    'FC2': 'fc2',
    'fc2': 'fc2',
    'Japanska': 'japanska',
    'japanska': 'japanska',
  };

  // Get products
  const allWorks = await getProducts({
    actressId: actress.id,
    sortBy,
    tags: includeTags.length > 0 ? includeTags : undefined,
    excludeTags: excludeTags.length > 0 ? excludeTags : undefined,
    limit: 1000,
  });

  const total = allWorks.length;
  const works = allWorks.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const basePath = `/${locale}/actress/${actress.id}`;

  // Structured data
  const personSchema = generatePersonSchema(actress.name, '', actress.heroImage || actress.thumbnail, basePath);
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: tNav('home'), url: `/${locale}` },
    { name: tNav('actresses'), url: `/${locale}/actresses` },
    { name: actress.name, url: basePath },
  ]);
  const worksSchema = works.length > 0 ? generateItemListSchema(
    works.map((w) => ({ name: w.title, url: `/${locale}/product/${w.id}` })),
    t('filmography'),
  ) : null;

  return (
    <>
      <JsonLD data={personSchema} />
      <JsonLD data={breadcrumbSchema} />
      {worksSchema && <JsonLD data={worksSchema} />}

      <div className="bg-gray-900 min-h-screen">
        <div className="container mx-auto px-4 py-8">
          {/* Breadcrumb */}
          <Breadcrumb
            items={[
              { label: tNav('home'), href: `/${locale}` },
              { label: tNav('actresses'), href: `/${locale}` },
              { label: actress.name },
            ]}
            className="mb-6"
          />

          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
            <div className="flex items-center gap-4 flex-1">
              <Image
                src={actress.heroImage}
                alt={actress.name}
                width={64}
                height={64}
                className="w-16 h-16 rounded-full object-cover"
              />
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-white">{actress.name}</h1>
                <p className="text-gray-300">{t('totalProducts', { count: total })}</p>
                {nonPrimaryAliases.length > 0 && (
                  <div className="mt-2">
                    <span className="text-sm text-gray-400">{t('aliases')}: </span>
                    <span className="text-sm text-gray-300">
                      {nonPrimaryAliases.map((alias, index) => (
                        <span key={alias.id}>
                          {alias.aliasName}
                          {index < nonPrimaryAliases.length - 1 ? ', ' : ''}
                        </span>
                      ))}
                    </span>
                  </div>
                )}
                {/* ASP別作品数バッジ */}
                {productCountByAsp.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {productCountByAsp.map((asp) => {
                      const providerId = aspToProviderId[asp.aspName];
                      const meta = providerId ? providerMeta[providerId] : null;
                      return (
                        <span
                          key={asp.aspName}
                          className={`text-xs font-semibold px-3 py-1 rounded-full bg-gradient-to-r ${meta?.accentClass || 'from-gray-600 to-gray-500'} text-white`}
                        >
                          {meta?.label || asp.aspName}: {asp.count}本
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <ProductSortDropdown sortBy={sortBy} basePath={basePath} />
          </div>

          {/* Tag Filters */}
          <form method="get" action={basePath}>
            <input type="hidden" name="sort" value={sortBy} />
            <details className="mb-8 bg-gray-800 rounded-lg border border-gray-700" open={includeTags.length > 0 || excludeTags.length > 0}>
              <summary className="px-4 py-3 cursor-pointer font-semibold text-white hover:bg-gray-750">
                {tf('genre')}
              </summary>
              <div className="px-4 pb-4 space-y-6">
                {/* Genre Tags */}
                {genreTags.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-3">{tf('genre')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-300 mb-2">{tf('include')}</p>
                        <div className="space-y-1 max-h-48 overflow-y-auto border border-gray-600 rounded p-2 bg-gray-750">
                          {genreTags.slice(0, 20).map((tag) => (
                            <label key={`include-genre-${tag.id}`} className="flex items-center gap-2 hover:bg-gray-700 p-1 rounded cursor-pointer">
                              <input
                                type="checkbox"
                                name="include"
                                value={tag.id}
                                defaultChecked={includeTags.includes(String(tag.id))}
                                className="rounded border-gray-500 text-rose-600 focus:ring-rose-500"
                              />
                              <span className="text-sm text-gray-200">{tag.name} ({tag.count})</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-gray-300 mb-2">{tf('exclude')}</p>
                        <div className="space-y-1 max-h-48 overflow-y-auto border border-gray-600 rounded p-2 bg-gray-750">
                          {genreTags.slice(0, 20).map((tag) => (
                            <label key={`exclude-genre-${tag.id}`} className="flex items-center gap-2 hover:bg-gray-700 p-1 rounded cursor-pointer">
                              <input
                                type="checkbox"
                                name="exclude"
                                value={tag.id}
                                defaultChecked={excludeTags.includes(String(tag.id))}
                                className="rounded border-gray-500 text-red-600 focus:ring-red-500"
                              />
                              <span className="text-sm text-gray-200">{tag.name} ({tag.count})</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Site Tags */}
                {siteTags.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-3">{tf('site')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-300 mb-2">{tf('include')}</p>
                        <div className="space-y-1 border border-gray-600 rounded p-2 bg-gray-750">
                          {siteTags.map((tag) => (
                            <label key={`include-site-${tag.id}`} className="flex items-center gap-2 hover:bg-gray-700 p-1 rounded cursor-pointer">
                              <input
                                type="checkbox"
                                name="include"
                                value={tag.id}
                                defaultChecked={includeTags.includes(String(tag.id))}
                                className="rounded border-gray-500 text-rose-600 focus:ring-rose-500"
                              />
                              <span className="text-sm text-gray-200">{tag.name} ({tag.count})</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-gray-300 mb-2">{tf('exclude')}</p>
                        <div className="space-y-1 border border-gray-600 rounded p-2 bg-gray-750">
                          {siteTags.map((tag) => (
                            <label key={`exclude-site-${tag.id}`} className="flex items-center gap-2 hover:bg-gray-700 p-1 rounded cursor-pointer">
                              <input
                                type="checkbox"
                                name="exclude"
                                value={tag.id}
                                defaultChecked={excludeTags.includes(String(tag.id))}
                                className="rounded border-gray-500 text-red-600 focus:ring-red-500"
                              />
                              <span className="text-sm text-gray-200">{tag.name} ({tag.count})</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Filter Buttons */}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-rose-600 text-white rounded-md hover:bg-rose-700 transition-colors"
                  >
                    {tc('apply')}
                  </button>
                  <Link
                    href={basePath}
                    className="px-4 py-2 border border-gray-600 text-gray-200 rounded-md hover:bg-gray-700 transition-colors"
                  >
                    {tc('clear')}
                  </Link>
                </div>
              </div>
            </details>
          </form>

          {/* Product List */}
          {total > 0 ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {works.map((work) => (
                  <ProductCard key={work.id} product={work} />
                ))}
              </div>
              {total > PER_PAGE && (
                <Pagination total={total} page={page} perPage={PER_PAGE} basePath={basePath} />
              )}
            </>
          ) : (
            <p className="text-center text-gray-400 py-12">{t('noProducts')}</p>
          )}
        </div>
      </div>
    </>
  );
}
