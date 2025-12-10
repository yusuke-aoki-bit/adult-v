import { notFound } from 'next/navigation';
import ProductCard from '@/components/ProductCard';
import ActressHeroImage from '@/components/ActressHeroImage';
import ActressAiReview from '@/components/ActressAiReview';
import Pagination from '@/components/Pagination';
import { JsonLD } from '@/components/JsonLD';
import Breadcrumb from '@/components/Breadcrumb';
import RelatedActresses from '@/components/RelatedActresses';
import { getActressById, getProducts, getTagsForActress, getPerformerAliases, getActressProductCountByAsp, getTagById } from '@/lib/db/queries';
import { getRelatedPerformers } from '@/lib/db/recommendations';
import {
  generateBaseMetadata,
  generatePersonSchema,
  generateBreadcrumbSchema,
  generateItemListSchema,
} from '@/lib/seo';
import { Metadata } from 'next';
import ProductSortDropdown from '@/components/ProductSortDropdown';
import { getTranslations } from 'next-intl/server';
import { providerMeta } from '@/lib/providers';
import ActressProductFilter from '@/components/ActressProductFilter';
import { ASP_TO_PROVIDER_ID } from '@/lib/constants/filters';
import ActressFavoriteButton from '@/components/ActressFavoriteButton';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ performerId: string; locale: string }>;
  searchParams: Promise<{
    page?: string;
    sort?: string;
    include?: string | string[];
    exclude?: string | string[];
    hasVideo?: string;
    hasImage?: string;
    performerType?: string;
    asp?: string | string[];
    limit?: string;
  }>;
}

const DEFAULT_PER_PAGE = 24;
const ALLOWED_PER_PAGE = [12, 24, 48, 96];

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  try {
    const { performerId, locale } = await params;
    const resolvedSearchParams = await searchParams;
    const actress = await getActressById(performerId, locale);
    if (!actress) return {};

    const t = await getTranslations('actress');

    // フィルター・ページネーションがある場合はnoindex
    const hasFilters = !!(
      resolvedSearchParams.include ||
      resolvedSearchParams.exclude ||
      resolvedSearchParams.hasVideo === 'true' ||
      resolvedSearchParams.hasImage === 'true' ||
      resolvedSearchParams.performerType ||
      resolvedSearchParams.asp
    );
    const hasPageParam = !!resolvedSearchParams.page && resolvedSearchParams.page !== '1';

    // includeパラメータがある場合、ジャンル名を取得
    const includeParam = resolvedSearchParams.include;
    const firstTagId = typeof includeParam === 'string'
      ? includeParam.split(',')[0]
      : Array.isArray(includeParam)
      ? includeParam[0]
      : null;

    if (firstTagId) {
      const tagIdNum = parseInt(firstTagId, 10);
      if (!isNaN(tagIdNum)) {
        const tag = await getTagById(tagIdNum);
        if (tag) {
          // ロケールに応じたタグ名を取得
          const tagName = locale === 'en' ? (tag.nameEn || tag.name)
            : locale === 'zh' ? (tag.nameZh || tag.name)
            : locale === 'ko' ? (tag.nameKo || tag.name)
            : tag.name;

          const metadata = generateBaseMetadata(
            t('metaTitleWithGenre', { name: actress.name, genre: tagName }),
            t('metaDescriptionWithGenre', { name: actress.name, genre: tagName }),
            actress.heroImage || actress.thumbnail,
            `/${locale}/actress/${actress.id}`,
            undefined,
            locale,
          );

          // フィルター/ページネーション時はnoindex
          if (hasFilters || hasPageParam) {
            return {
              ...metadata,
              robots: { index: false, follow: true },
            };
          }
          return metadata;
        }
      }
    }

    // 通常のメタデータ
    const title = t('metaTitle', { name: actress.name, count: actress.metrics.releaseCount });

    const metadata = generateBaseMetadata(
      title,
      t('metaDescription', { name: actress.name, count: actress.metrics.releaseCount }),
      actress.heroImage || actress.thumbnail,
      `/${locale}/actress/${actress.id}`,
      undefined,
      locale,
    );

    // フィルター/ページネーション時はnoindex（重複コンテンツ防止）
    if (hasFilters || hasPageParam) {
      return {
        ...metadata,
        robots: { index: false, follow: true },
      };
    }

    return metadata;
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
  let actress = await getActressById(decodedId, locale);
  if (!actress) actress = await getActressById(performerId, locale);
  if (!actress) notFound();

  const page = parseInt(resolvedSearchParams.page || '1', 10);
  const sortBy = (resolvedSearchParams.sort || 'releaseDateDesc') as 'releaseDateDesc' | 'releaseDateAsc' | 'priceDesc' | 'priceAsc' | 'titleAsc';

  // 表示件数（URLパラメータから取得、許可リストでバリデーション）
  const requestedLimit = parseInt(resolvedSearchParams.limit || String(DEFAULT_PER_PAGE), 10);
  const perPage = ALLOWED_PER_PAGE.includes(requestedLimit) ? requestedLimit : DEFAULT_PER_PAGE;

  // hasVideo/hasImageフィルター
  const hasVideo = resolvedSearchParams.hasVideo === 'true';
  const hasImage = resolvedSearchParams.hasImage === 'true';
  const performerType = resolvedSearchParams.performerType as 'solo' | 'multi' | undefined;

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

  // Get ASP filter
  const includeAsps = typeof resolvedSearchParams.asp === 'string'
    ? resolvedSearchParams.asp.split(',').filter(Boolean)
    : Array.isArray(resolvedSearchParams.asp)
    ? resolvedSearchParams.asp
    : [];

  // Get tags for the actress
  const genreTags = await getTagsForActress(actress.id, 'genre');

  // Get aliases for the actress
  const aliases = await getPerformerAliases(parseInt(actress.id));
  const nonPrimaryAliases = aliases.filter(alias => !alias.isPrimary);

  // Get product count by ASP
  const productCountByAsp = await getActressProductCountByAsp(actress.id);

  // Get related performers (co-stars)
  const relatedPerformers = await getRelatedPerformers(parseInt(actress.id), 6);

  // Get products
  const allWorks = await getProducts({
    actressId: actress.id,
    sortBy,
    tags: includeTags.length > 0 ? includeTags : undefined,
    excludeTags: excludeTags.length > 0 ? excludeTags : undefined,
    hasVideo: hasVideo || undefined,
    hasImage: hasImage || undefined,
    performerType: performerType || undefined,
    providers: includeAsps.length > 0 ? includeAsps : undefined,
    limit: 1000,
    locale,
  });

  const total = allWorks.length;
  const works = allWorks.slice((page - 1) * perPage, page * perPage);

  const basePath = `/${locale}/actress/${actress.id}`;

  // Structured data
  const personSchema = generatePersonSchema(actress.name, '', actress.heroImage || actress.thumbnail, basePath);
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: tNav('home'), url: `/${locale}` },
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
              { label: actress.name },
            ]}
            className="mb-6"
          />

          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-2 sm:gap-4 mb-6 sm:mb-8">
            <div className="flex items-center gap-2 sm:gap-4 flex-1">
              <ActressHeroImage
                src={actress.heroImage || actress.thumbnail}
                alt={actress.name}
                size={64}
                className="w-16 h-16"
              />
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-white">{actress.name}</h1>
                  <ActressFavoriteButton
                    id={actress.id}
                    name={actress.name}
                    thumbnail={actress.heroImage || actress.thumbnail}
                  />
                </div>
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
                  <div className="mt-2 sm:mt-3 flex flex-wrap gap-1 sm:gap-2">
                    {productCountByAsp.map((asp) => {
                      const providerId = ASP_TO_PROVIDER_ID[asp.aspName];
                      const meta = providerId ? providerMeta[providerId] : null;
                      return (
                        <span
                          key={asp.aspName}
                          className={`text-[10px] sm:text-xs font-semibold px-2 sm:px-3 py-0.5 sm:py-1 rounded-full whitespace-nowrap bg-gradient-to-r ${meta?.accentClass || 'from-gray-600 to-gray-500'} text-white`}
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

          {/* AIレビュー表示 */}
          {actress.aiReview && (
            <div className="mb-8">
              <ActressAiReview
                review={actress.aiReview}
                updatedAt={actress.aiReviewUpdatedAt}
                actressName={actress.name}
              />
            </div>
          )}

          {/* Tag Filters - 即時適用 */}
          <ActressProductFilter
            genreTags={genreTags}
            productCountByAsp={productCountByAsp}
            translations={{
              filterSettings: tf('filterSettings'),
              sampleContent: tf('sampleContent'),
              sampleVideo: tf('sampleVideo'),
              sampleImage: tf('sampleImage'),
              genre: tf('genre'),
              include: tf('include'),
              exclude: tf('exclude'),
              site: tf('site'),
              clear: tf('clear'),
              performerType: tf('performerType'),
              solo: tf('solo'),
              multi: tf('multi'),
            }}
          />

          {/* Product List */}
          {total > 0 ? (
            <>
              {/* ページネーション（上部） */}
              {total > perPage && (
                <Pagination total={total} page={page} perPage={perPage} basePath={basePath} position="top" showPerPageSelector />
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {works.map((work) => (
                  <ProductCard key={work.id} product={work} />
                ))}
              </div>
              {/* ページネーション（下部） */}
              {total > perPage && (
                <Pagination total={total} page={page} perPage={perPage} basePath={basePath} position="bottom" showPerPageSelector />
              )}
            </>
          ) : (
            <p className="text-center text-gray-400 py-12">{t('noProducts')}</p>
          )}

          {/* 関連女優（共演者）セクション */}
          {relatedPerformers.length > 0 && (
            <RelatedActresses
              actresses={relatedPerformers}
              currentActressName={actress.name}
            />
          )}
        </div>
      </div>
    </>
  );
}
