import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import ProductCard from '@/components/ProductCard';
import {
  ActressHeroImage,
  Pagination,
  FanzaSiteLink,
  CrossAspInfo,
  ActressAiReview,
  PerformerTopProducts,
  PerformerOnSaleProducts,
  SectionVisibility,
  SocialShareButtons,
} from '@adult-v/shared/components';
import { JsonLD } from '@/components/JsonLD';
import Breadcrumb from '@/components/Breadcrumb';
import { getActressById, getProducts, getProductsCount, getTagsForActress, getPerformerAliases, getActressProductCountByAsp, getTagById, getActressCareerAnalysis } from '@/lib/db/queries';
import ActressCareerTimeline from '@/components/ActressCareerTimeline';
import RetirementAlert from '@/components/RetirementAlert';
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
import { providerMeta } from '@/lib/providers';
import ActressProductFilter from '@/components/ActressProductFilter';
import { ASP_TO_PROVIDER_ID } from '@/lib/constants/filters';
import ActressFavoriteButton from '@/components/ActressFavoriteButton';
import AiActressProfileWrapper from '@/components/AiActressProfileWrapper';
import PerformerRelationMap from '@/components/PerformerRelationMap';
import SimilarPerformerMap from '@/components/SimilarPerformerMap';
import ActressSectionNav from '@/components/ActressSectionNav';
import PerPageDropdown from '@/components/PerPageDropdown';
import { localizedHref } from '@adult-v/shared/i18n';

// getTranslationsを使用するServer ComponentsはISRとの互換性がないため、
// force-dynamicを設定して動的レンダリングを強制
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
    perPage?: string;
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

const DEFAULT_PER_PAGE = 48;
const VALID_PER_PAGE = [12, 24, 48, 96];

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  try {
    const { performerId, locale } = await params;
    const resolvedSearchParams = await searchParams;
    const actress = await getActressById(performerId, locale);
    if (!actress) return {};

    const t = await getTranslations('actress');
    const baseUrl = process.env['NEXT_PUBLIC_SITE_URL'] || 'https://example.com';

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
    const title = t('metaTitle', { name: actress.name, count: actress.metrics?.releaseCount ?? 0 });

    const metadata = generateBaseMetadata(
      title,
      t('metaDescription', { name: actress.name, count: actress.metrics?.releaseCount ?? 0 }),
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
  const t = await getTranslations('actress');
  const tf = await getTranslations('filter');
  const tNav = await getTranslations('nav');
  const tTopProducts = await getTranslations('performerTopProducts');
  const tOnSale = await getTranslations('performerOnSale');

  const decodedId = decodeURIComponent(performerId);
  let actress = await getActressById(decodedId, locale);
  if (!actress) actress = await getActressById(performerId, locale);
  if (!actress) notFound();

  const page = parseInt(resolvedSearchParams.page || '1', 10);
  const sortBy = (resolvedSearchParams.sort || 'releaseDateDesc') as 'releaseDateDesc' | 'releaseDateAsc' | 'priceDesc' | 'priceAsc' | 'titleAsc';

  // 表示件数（URLパラメータから取得、無効な値はデフォルトに）
  const perPageParam = parseInt(resolvedSearchParams.perPage || '', 10);
  const perPage = VALID_PER_PAGE.includes(perPageParam) ? perPageParam : DEFAULT_PER_PAGE;


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

  // Common filter options for products query (exactOptionalPropertyTypes対応)
  const productFilterOptions = {
    actressId: actress.id,
    ...(includeTags.length > 0 && { tags: includeTags }),
    ...(excludeTags.length > 0 && { excludeTags }),
    ...(hasVideo && { hasVideo: true as const }),
    ...(hasImage && { hasImage: true as const }),
    ...(performerType && { performerType }),
    ...(includeAsps.length > 0 && { providers: includeAsps }),
  };

  // Parallel fetch for all actress data (performance optimization)
  // Uses DB-level pagination instead of fetching all 1000 products
  const [genreTags, aliases, productCountByAsp, careerAnalysis, topProducts, onSaleProducts, works, total] =
    await Promise.all([
      getTagsForActress(actress.id, 'genre'),
      getPerformerAliases(parseInt(actress.id)),
      getActressProductCountByAsp(actress.id),
      getActressCareerAnalysis(actress.id),
      getPerformerTopProducts(parseInt(actress.id), 5),
      getPerformerOnSaleProducts(parseInt(actress.id), 6),
      getProducts({
        ...productFilterOptions,
        sortBy,
        limit: perPage,
        offset: (page - 1) * perPage,
        locale,
      }),
      getProductsCount(productFilterOptions),
    ]);
  const nonPrimaryAliases = aliases.filter(alias => !alias.isPrimary);

  const basePath = localizedHref(`/actress/${actress.id}`, locale);

  // Structured data with enhanced Person Schema
  // aiReviewがオブジェクト型の場合は空文字列を使用
  const aiReviewText = typeof actress.aiReview === 'string' ? actress.aiReview : '';
  // exactOptionalPropertyTypes対応: undefinedを含むプロパティは条件付きで追加
  const personSchemaOptions: { workCount: number; aliases: string[]; debutYear?: number } = {
    workCount: total,
    aliases: nonPrimaryAliases.map(a => a.aliasName),
  };
  if (careerAnalysis?.debutYear != null) {
    personSchemaOptions.debutYear = careerAnalysis.debutYear;
  }

  const personSchema = generatePersonSchema(
    actress.name,
    aiReviewText,
    actress.heroImage || actress.thumbnail || '',
    basePath,
    personSchemaOptions
  );
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: tNav('home'), url: localizedHref('/', locale) },
    { name: actress.name, url: basePath },
  ]);
  const worksSchema = works.length > 0 ? generateItemListSchema(
    works.map((w) => ({ name: w.title, url: localizedHref(`/products/${w.id}`, locale) })),
    t('filmography'),
  ) : null;

  // FAQ Schema生成（リッチリザルト対応）- exactOptionalPropertyTypes対応
  const actressFaqOptions: {
    name: string;
    productCount: number;
    debutYear?: number;
    latestReleaseDate?: string;
    aliases?: string[];
    topGenres?: string[];
    aspNames?: string[];
    isRetired?: boolean;
  } = {
    name: actress.name,
    productCount: total,
  };
  if (careerAnalysis?.debutYear != null) {
    actressFaqOptions.debutYear = careerAnalysis.debutYear;
  }
  if (works[0]?.releaseDate) {
    actressFaqOptions.latestReleaseDate = new Date(works[0].releaseDate).toLocaleDateString('ja-JP');
  }
  if (nonPrimaryAliases.length > 0) {
    actressFaqOptions.aliases = nonPrimaryAliases.map(a => a.aliasName);
  }
  if (genreTags.length > 0) {
    actressFaqOptions.topGenres = genreTags.slice(0, 5).map(t => t.name);
  }
  if (productCountByAsp.length > 0) {
    actressFaqOptions.aspNames = productCountByAsp.map(a => a.aspName);
  }
  if (careerAnalysis) {
    actressFaqOptions.isRetired = !careerAnalysis.isActive;
  }

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
            className="mb-4"
          />

          {/* PR表記（景品表示法・ステマ規制対応） */}
          <p className="text-xs theme-text-muted mb-6">
            <span className="font-bold text-yellow-400 bg-yellow-900/30 px-1.5 py-0.5 rounded mr-1.5">PR</span>
            当ページには広告・アフィリエイトリンクが含まれています
          </p>

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
                {/* SNSシェアボタン */}
                <div className="mt-2">
                  <SocialShareButtons
                    title={`${actress.name} - ${t('totalProducts', { count: total })}`}
                    compact
                    hashtags={['AV女優', actress.name.replace(/\s/g, '')]}
                  />
                </div>
                {nonPrimaryAliases.length > 0 && (
                  <p className="mt-1 text-xs sm:text-sm theme-text-muted truncate">
                    {t('aliases')}: {nonPrimaryAliases.map(a => a.aliasName).join(', ')}
                  </p>
                )}
              </div>
            </div>
            {/* ASP別作品数バッジ */}
            {productCountByAsp.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5 items-center">
                {productCountByAsp.map((asp) => {
                  const providerId = ASP_TO_PROVIDER_ID[asp.aspName];
                  const meta = providerId ? providerMeta[providerId] : null;
                  const colors = meta?.gradientColors || { from: '#4b5563', to: '#374151' };
                  return (
                    <span
                      key={asp.aspName}
                      className="text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap text-white"
                      style={{ background: `linear-gradient(to right, ${colors.from}, ${colors.to})` }}
                    >
                      {meta?.label || asp.aspName}: {asp.count}
                    </span>
                  );
                })}
                {/* FANZAサイトへのクロスリンク */}
                {productCountByAsp.some(asp => asp.aspName.toUpperCase() === 'FANZA') && (
                  <FanzaSiteLink
                    path={`/actress/${actress.id}`}
                    locale={locale}
                    label={t('viewOnFanzaSite')}
                    compact
                  />
                )}
              </div>
            )}
            {/* ソートドロップダウン・表示件数 */}
            <div className="mt-3 flex justify-end items-center gap-4">
              <PerPageDropdown
                perPage={perPage}
                basePath={basePath}
              />
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

          {/* AIレビュー表示 */}
          {actress.aiReview && (
            <SectionVisibility sectionId="ai-review" pageId="actress" locale={locale}>
              <div id="ai-review" className="mb-8">
                <ActressAiReview
                  review={actress.aiReview}
                  updatedAt={actress.aiReviewUpdatedAt ?? ''}
                  actressName={actress.name}
                  theme="dark"
                />
              </div>
            </SectionVisibility>
          )}

          {/* AI生成のプロフィール */}
          <div className="mb-8">
            <AiActressProfileWrapper
              actressId={actress.id}
              locale={locale}
            />
          </div>

          {/* クロスASP情報表示 */}
          {(aliases.length > 0 || productCountByAsp.length > 1) && (
            <div className="mb-8">
              <CrossAspInfo
                performerId={parseInt(actress.id)}
                performerName={actress.name}
                aliases={aliases}
                aspCounts={productCountByAsp}
                locale={locale}
                fanzaSiteUrl="https://www.f.adult-v.com"
              />
            </div>
          )}

          {/* キャリア分析セクション */}
          {careerAnalysis && (
            <SectionVisibility sectionId="career" pageId="actress" locale={locale}>
              <div id="career" className="mb-8">
                <ActressCareerTimeline
                  career={careerAnalysis}
                  actressName={actress.name}
                  locale={locale}
                />
              </div>
            </SectionVisibility>
          )}

          {/* 人気作品TOP5セクション */}
          {topProducts.length > 0 && (
            <SectionVisibility sectionId="top-products" pageId="actress" locale={locale}>
              <div id="top-products">
                <PerformerTopProducts
                  products={topProducts}
                  performerName={actress.name}
                  locale={locale}
                  theme="dark"
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
            </SectionVisibility>
          )}

          {/* セール中作品セクション */}
          {onSaleProducts.length > 0 && (
            <SectionVisibility sectionId="on-sale" pageId="actress" locale={locale}>
              <div id="on-sale">
                <PerformerOnSaleProducts
                  products={onSaleProducts}
                  performerName={actress.name}
                  locale={locale}
                  theme="dark"
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
            </SectionVisibility>
          )}

          {/* Tag Filters - 即時適用 */}
          <SectionVisibility sectionId="filmography" pageId="actress" locale={locale}>
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
              {total > perPage && (
                <Pagination
                  total={total}
                  page={page}
                  perPage={perPage}
                  basePath={basePath}
                  position="top"
                  queryParams={{
                    ...(perPage !== DEFAULT_PER_PAGE ? { perPage: String(perPage) } : {}),
                  }}
                />
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {works.map((work) => (
                  <ProductCard key={work.id} product={work} />
                ))}
              </div>
              {/* ページネーション（下部） */}
              {total > perPage && (
                <Pagination
                  total={total}
                  page={page}
                  perPage={perPage}
                  basePath={basePath}
                  position="bottom"
                  queryParams={{
                    ...(perPage !== DEFAULT_PER_PAGE ? { perPage: String(perPage) } : {}),
                  }}
                />
              )}
            </>
          ) : (
            <p className="text-center theme-text-muted py-12">{t('noProducts')}</p>
          )}
          </div>
          </SectionVisibility>

          {/* 共演者マップ（インタラクティブ） */}
          <SectionVisibility sectionId="costar-network" pageId="actress" locale={locale}>
            <div id="costar-network" className="mt-12 mb-8">
              <Suspense fallback={<div className="h-64 bg-gray-800 rounded-lg animate-pulse" />}>
                <PerformerRelationMap
                  performerId={parseInt(actress.id)}
                  locale={locale}
                />
              </Suspense>
            </div>
          </SectionVisibility>

          {/* 類似女優マップ（ジャンル・メーカー・プロフィール複合スコア） */}
          <SectionVisibility sectionId="similar-network" pageId="actress" locale={locale}>
            <div id="similar-network" className="mb-8">
              <Suspense fallback={<div className="h-64 bg-gray-800 rounded-lg animate-pulse" />}>
                <SimilarPerformerMap
                  performerId={parseInt(actress.id)}
                  locale={locale}
                />
              </Suspense>
            </div>
          </SectionVisibility>
        </div>
      </div>
    </>
  );
}
