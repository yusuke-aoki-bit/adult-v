import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import ProductCard from '@/components/ProductCard';
import {
  ActressHeroImage,
  Pagination,
  PerformerTopProducts,
  PerformerOnSaleProducts,
} from '@adult-v/shared/components';
import ActressAiReview from '@/components/ActressAiReview';
import { JsonLD } from '@/components/JsonLD';
import Breadcrumb from '@/components/Breadcrumb';
import RetirementAlert from '@/components/RetirementAlert';
import ActressCareerTimeline from '@/components/ActressCareerTimeline';
import { getActressById, getProducts, getProductsCount, getTagsForActress, getPerformerAliases, getActressProductCountByAsp, getTagById, getActressCareerAnalysis } from '@/lib/db/queries';
import { getPerformerTopProducts, getPerformerOnSaleProducts } from '@/lib/db/recommendations';
import {
  generateBaseMetadata,
  generatePersonSchema,
  generateBreadcrumbSchema,
  generateItemListSchema,
  generateFAQSchema,
  getActressPageFAQs,
} from '@/lib/seo';
import { Metadata } from 'next';
import ProductSortDropdown from '@/components/ProductSortDropdown';
import { getTranslations } from 'next-intl/server';
import '@/lib/providers';
import ActressProductFilter from '@/components/ActressProductFilter';
import '@/lib/constants/filters';
import ActressFavoriteButton from '@/components/ActressFavoriteButton';
import AiActressProfileWrapper from '@/components/AiActressProfileWrapper';
import PerformerRelationMap from '@/components/PerformerRelationMap';
import SimilarPerformerMap from '@/components/SimilarPerformerMap';
import ActressSectionNav from '@/components/ActressSectionNav';
import { localizedHref } from '@adult-v/shared/i18n';

// Force dynamic rendering to avoid DYNAMIC_SERVER_USAGE errors with getTranslations
// ISR with revalidate is not compatible with dynamic server functions
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

/**
 * ビルド時に人気女優をプリレンダリング
 * 作品数上位1000名（日本語版のみ）
 */
export async function generateStaticParams(): Promise<Array<{ performerId: string; locale: string }>> {
  try {
    const { getActresses } = await import('@/lib/db/queries');
    const topActresses = await getActresses({ limit: 1000, sortBy: 'productCountDesc' });
    return topActresses.map((actress) => ({
      performerId: actress.id.toString(),
      locale: 'ja',
    }));
  } catch {
    return [];
  }
}

const PER_PAGE = 96;

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
            localizedHref(`/actress/${actress.id}`, locale),
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
    const releaseCount = actress.metrics?.releaseCount ?? actress.releaseCount ?? 0;
    const title = t('metaTitle', { name: actress.name, count: releaseCount });
    const baseUrl = process.env['NEXT_PUBLIC_SITE_URL'] || 'https://example.com';

    const metadata = generateBaseMetadata(
      title,
      t('metaDescription', { name: actress.name, count: releaseCount }),
      actress.heroImage || actress.thumbnail,
      localizedHref(`/actress/${actress.id}`, locale),
      undefined,
      locale,
    );

    // hreflang/canonical設定（?hl=パラメータ方式）
    // canonical URLは全言語で統一（パラメータなし）
    const actressPath = `/actress/${actress.id}`;
    const canonicalUrl = `${baseUrl}${actressPath}`;
    const alternates = {
      canonical: canonicalUrl,
      languages: {
        'ja': `${baseUrl}${actressPath}`,
        'en': `${baseUrl}${actressPath}?hl=en`,
        'zh': `${baseUrl}${actressPath}?hl=zh`,
        'zh-TW': `${baseUrl}${actressPath}?hl=zh-TW`,
        'ko': `${baseUrl}${actressPath}?hl=ko`,
        'x-default': `${baseUrl}${actressPath}`,
      },
    };

    // フィルター/ページネーション時はnoindex（重複コンテンツ防止）
    if (hasFilters || hasPageParam) {
      return {
        ...metadata,
        alternates,
        robots: { index: false, follow: true },
      };
    }

    return { ...metadata, alternates };
  } catch {
    return {};
  }
}

export default async function ActressDetailPage({ params, searchParams }: PageProps) {
  const { performerId, locale } = await params;
  const resolvedSearchParams = await searchParams;

  let t, tf, tNav, tTopProducts, tOnSale, actress;
  try {
    [t, tf, tNav, tTopProducts, tOnSale] = await Promise.all([
      getTranslations('actress'),
      getTranslations('filter'),
      getTranslations('nav'),
      getTranslations('performerTopProducts'),
      getTranslations('performerOnSale'),
    ]);
    const decodedId = decodeURIComponent(performerId);
    actress = await getActressById(decodedId, locale);
    if (!actress) actress = await getActressById(performerId, locale);
  } catch (error) {
    console.error(`[actress-detail] Error loading performer ${performerId}:`, error);
    notFound();
  }
  if (!actress) notFound();

  const page = Math.max(1, Math.min(parseInt(resolvedSearchParams.page || '1', 10), 500));
  const sortBy = (resolvedSearchParams.sort || 'releaseDateDesc') as 'releaseDateDesc' | 'releaseDateAsc' | 'priceDesc' | 'priceAsc' | 'titleAsc';


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

  // Common filter options for products query
  const productFilterOptions: {
    actressId: string;
    tags?: string[];
    excludeTags?: string[];
    hasVideo?: true;
    hasImage?: true;
    performerType?: 'solo' | 'multi';
    providers?: string[];
  } = {
    actressId: actress.id,
  };
  if (includeTags.length > 0) productFilterOptions.tags = includeTags;
  if (excludeTags.length > 0) productFilterOptions.excludeTags = excludeTags;
  if (hasVideo) productFilterOptions.hasVideo = true;
  if (hasImage) productFilterOptions.hasImage = true;
  if (performerType) productFilterOptions.performerType = performerType;
  if (includeAsps.length > 0) productFilterOptions.providers = includeAsps;

  // Parallel fetch for all actress data (performance optimization)
  // Uses DB-level pagination instead of fetching all 1000 products
  const [genreTags, aliases, productCountByAsp, careerAnalysis, topProducts, onSaleProducts, works, total] =
    await Promise.all([
      getTagsForActress(actress.id, 'genre'),
      getPerformerAliases(parseInt(actress.id)),
      getActressProductCountByAsp(actress.id),
      getActressCareerAnalysis(actress.id),
      getPerformerTopProducts(parseInt(actress.id), 5, 'fanza'),
      getPerformerOnSaleProducts(parseInt(actress.id), 6, 'fanza'),
      getProducts({
        ...productFilterOptions,
        sortBy,
        limit: PER_PAGE,
        offset: (page - 1) * PER_PAGE,
        locale,
      }),
      getProductsCount(productFilterOptions),
    ]);
  const nonPrimaryAliases = aliases.filter(alias => !alias.isPrimary);

  const basePath = localizedHref(`/actress/${actress.id}`, locale);

  // Structured data with enhanced Person Schema
  // aiReviewがオブジェクト型の場合は空文字列を使用
  const aiReviewText = typeof actress.aiReview === 'string' ? actress.aiReview : '';
  const personSchemaOptions: Parameters<typeof generatePersonSchema>[4] = {
    workCount: total,
    aliases: nonPrimaryAliases.map(a => a.aliasName),
  };
  if (careerAnalysis?.debutYear != null) personSchemaOptions.debutYear = careerAnalysis.debutYear;
  const personSchema = generatePersonSchema(
    actress.name,
    aiReviewText,
    actress.heroImage || actress.thumbnail || '',
    basePath,
    personSchemaOptions,
  );
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: tNav('home'), url: localizedHref('/', locale) },
    { name: actress.name, url: basePath },
  ]);
  const worksSchema = works.length > 0 ? generateItemListSchema(
    works.map((w) => ({ name: w.title, url: localizedHref(`/product/${w.id}`, locale) })),
    t('filmography'),
  ) : null;

  // FAQ Schema生成（リッチリザルト対応）
  const actressFaqOptions: Parameters<typeof getActressPageFAQs>[1] = {
    name: actress.name,
    productCount: total,
  };
  if (careerAnalysis?.debutYear != null) actressFaqOptions.debutYear = careerAnalysis.debutYear;
  const firstWork = works[0];
  if (firstWork?.releaseDate) actressFaqOptions.latestReleaseDate = new Date(firstWork.releaseDate).toLocaleDateString('ja-JP');
  if (nonPrimaryAliases.length > 0) actressFaqOptions.aliases = nonPrimaryAliases.map(a => a.aliasName);
  if (genreTags.length > 0) actressFaqOptions.topGenres = genreTags.slice(0, 5).map(tag => tag.name);
  if (productCountByAsp.length > 0) actressFaqOptions.aspNames = productCountByAsp.map(a => a.aspName);
  if (careerAnalysis) actressFaqOptions.isRetired = !careerAnalysis.isActive;
  const actressFaqs = getActressPageFAQs(locale, actressFaqOptions);
  const faqSchema = generateFAQSchema(actressFaqs);

  return (
    <>
      <JsonLD data={personSchema} />
      <JsonLD data={breadcrumbSchema} />
      {worksSchema && <JsonLD data={worksSchema} />}
      <JsonLD data={faqSchema} />

      <div className="theme-body min-h-screen">
        {/* セクションナビゲーション */}
        <ActressSectionNav
          locale={locale}
          hasAiReview={!!actress.aiReview}
          hasCareerAnalysis={!!careerAnalysis}
          hasTopProducts={topProducts.length > 0}
          hasOnSaleProducts={onSaleProducts.length > 0}
        />

        <div className="container mx-auto px-4 py-8">
          {/* Breadcrumb */}
          <Breadcrumb
            items={[
              { label: tNav('home'), href: localizedHref('/', locale) },
              { label: actress.name },
            ]}
            className="mb-6"
          />

          {/* Header */}
          <div id="profile" className="mb-6 sm:mb-8">
            <div className="flex items-start gap-3 sm:gap-4">
              <ActressHeroImage
                src={actress.heroImage || actress.thumbnail}
                alt={actress.name}
                size={64}
                className="w-14 h-14 sm:w-16 sm:h-16 shrink-0"
                priority
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-bold theme-text truncate">{actress.name}</h1>
                  <ActressFavoriteButton
                    id={actress.id}
                    name={actress.name}
                    thumbnail={actress.heroImage || actress.thumbnail || ''}
                  />
                </div>
                <p className="text-sm sm:text-base theme-text-secondary">{t('totalProducts', { count: total })}</p>
                {nonPrimaryAliases.length > 0 && (
                  <p className="mt-1 text-xs sm:text-sm theme-text-muted truncate">
                    {t('aliases')}: {nonPrimaryAliases.map(a => a.aliasName).join(', ')}
                  </p>
                )}
              </div>
            </div>
            {/* ソートドロップダウン */}
            <div className="mt-3 flex justify-end">
              <ProductSortDropdown sortBy={sortBy} basePath={basePath} />
            </div>
          </div>

          {/* 卒業/引退アラート */}
          {careerAnalysis && (
            <div className="mb-4">
              <RetirementAlert
                career={careerAnalysis}
                actressName={actress.name}
                locale={locale}
              />
            </div>
          )}

          {/* キャリアタイムライン */}
          {careerAnalysis && (
            <div id="career" className="mb-6">
              <ActressCareerTimeline
                career={careerAnalysis}
                actressName={actress.name}
                locale={locale}
              />
            </div>
          )}

          {/* AIレビュー表示 */}
          {actress.aiReview && (
            <div id="ai-review" className="mb-8">
              <ActressAiReview
                review={actress.aiReview}
                updatedAt={actress.aiReviewUpdatedAt ?? ''}
                actressName={actress.name}
              />
            </div>
          )}

          {/* AI生成のプロフィール */}
          <div className="mb-8">
            <AiActressProfileWrapper
              actressId={actress.id}
              locale={locale}
            />
          </div>

          {/* 人気作品TOP5セクション */}
          {topProducts.length > 0 && (
            <div id="top-products">
            <PerformerTopProducts
              products={topProducts}
              performerName={actress.name}
              locale={locale}
              theme="light"
              translations={{
                title: tTopProducts('title', { name: actress.name }),
                description: tTopProducts('description'),
                rating: tTopProducts('rating'),
                reviews: tTopProducts('reviews'),
                views: tTopProducts('views'),
                onSale: tTopProducts('onSale'),
              }}
            />
            </div>
          )}

          {/* セール中作品セクション */}
          {onSaleProducts.length > 0 && (
            <div id="on-sale">
            <PerformerOnSaleProducts
              products={onSaleProducts}
              performerName={actress.name}
              locale={locale}
              theme="light"
              translations={{
                title: tOnSale('title', { name: actress.name }),
                description: tOnSale('description'),
                off: tOnSale('off'),
                endsIn: tOnSale('endsIn'),
                endsTomorrow: tOnSale('endsTomorrow'),
                endsToday: tOnSale('endsToday'),
                yen: tOnSale('yen'),
              }}
            />
            </div>
          )}

          {/* Tag Filters - 即時適用 */}
          <div id="filmography">
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
              {total > PER_PAGE && (
                <Pagination total={total} page={page} perPage={PER_PAGE} basePath={basePath} position="top" />
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {works.map((work) => (
                  <ProductCard key={work.id} product={work} />
                ))}
              </div>
              {/* ページネーション（下部） */}
              {total > PER_PAGE && (
                <Pagination total={total} page={page} perPage={PER_PAGE} basePath={basePath} position="bottom" />
              )}
            </>
          ) : (
            <p className="text-center theme-text-muted py-12">{t('noProducts')}</p>
          )}
          </div>

          {/* 共演者マップ */}
          <div id="costar-network" className="mt-12 mb-8">
            <Suspense fallback={<div className="h-64 bg-gray-100 rounded-lg animate-pulse" />}>
              <PerformerRelationMap
                performerId={parseInt(actress.id)}
                locale={locale}
              />
            </Suspense>
          </div>

          {/* 類似女優マップ */}
          <div id="similar-network" className="mb-8">
            <Suspense fallback={<div className="h-64 bg-gray-100 rounded-lg animate-pulse" />}>
              <SimilarPerformerMap
                performerId={parseInt(actress.id)}
                locale={locale}
              />
            </Suspense>
          </div>
        </div>
      </div>
    </>
  );
}
