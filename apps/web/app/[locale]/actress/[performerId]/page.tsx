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
import { getCachedActressById, getProducts, getProductsCount, getTagsForActress, getPerformerAliases, getActressProductCountByAsp, getTagById, getActressCareerAnalysis, getActressBudgetSummary } from '@/lib/db/queries';
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
import Link from 'next/link';
import { localizedHref } from '@adult-v/shared/i18n';

// force-dynamic: next-intl/sentryがheaders()を内部呼出しするためISR不可
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
 * 作品数上位5000名 × 5言語 = 最大25,000ページ
 */
export async function generateStaticParams(): Promise<Array<{ performerId: string; locale: string }>> {
  try {
    const { getActresses } = await import('@/lib/db/queries');
    const topActresses = await getActresses({ limit: 5000, sortBy: 'productCountDesc' });
    const locales = ['ja', 'en', 'zh', 'zh-TW', 'ko'];

    return topActresses.flatMap((actress) =>
      locales.map((locale) => ({
        performerId: actress.id.toString(),
        locale,
      }))
    );
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
    const actress = await getCachedActressById(performerId, locale);
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

  let t, tf, tNav, tTopProducts, tOnSale, actress;
  try {
    [t, tf, tNav, tTopProducts, tOnSale, actress] = await Promise.all([
      getTranslations('actress'),
      getTranslations('filter'),
      getTranslations('nav'),
      getTranslations('performerTopProducts'),
      getTranslations('performerOnSale'),
      getCachedActressById(performerId, locale),
    ]);
  } catch (error) {
    console.error(`[actress-detail] Error loading performer ${performerId}:`, error);
    notFound();
  }
  if (!actress) notFound();

  const page = Math.max(1, Math.min(parseInt(resolvedSearchParams.page || '1', 10), 500));
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
  let genreTags, aliases, productCountByAsp, careerAnalysis, topProducts, onSaleProducts, works, total, budgetSummary;
  try {
    [genreTags, aliases, productCountByAsp, careerAnalysis, topProducts, onSaleProducts, works, total, budgetSummary] =
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
        getActressBudgetSummary(actress.id),
      ]);
  } catch (error) {
    console.error(`[actress-detail] Error loading actress data for ${performerId}:`, error);
    notFound();
  }
  const nonPrimaryAliases = aliases.filter(alias => !alias.isPrimary);

  const basePath = localizedHref(`/actress/${actress.id}`, locale);

  // Structured data with enhanced Person Schema
  // aiReviewがオブジェクト型の場合は空文字列を使用
  const aiReviewText = typeof actress.aiReview === 'string' ? actress.aiReview : '';
  // exactOptionalPropertyTypes対応: undefinedを含むプロパティは条件付きで追加
  // sameAs: FANZA専門サイトのURLを生成（クロスプラットフォーム連携）
  const sameAsUrls: string[] = [];
  if (productCountByAsp.some(asp => asp.aspName.toUpperCase() === 'FANZA')) {
    sameAsUrls.push(`https://www.f.adult-v.com/actress/${actress.id}`);
  }

  const personSchemaOptions: { workCount: number; aliases: string[]; debutYear?: number; sameAs?: string[] } = {
    workCount: total,
    aliases: nonPrimaryAliases.map(a => a.aliasName),
  };
  if (careerAnalysis?.debutYear != null) {
    personSchemaOptions.debutYear = careerAnalysis.debutYear;
  }
  if (sameAsUrls.length > 0) {
    personSchemaOptions.sameAs = sameAsUrls;
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
            {/* 人気ジャンルリンク（回遊促進） */}
            {genreTags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {genreTags.slice(0, 8).map((tag) => (
                  <Link
                    key={tag.id}
                    href={localizedHref(`/tags/${tag.id}`, locale)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-700/80 hover:bg-rose-600/30 text-gray-300 hover:text-rose-300 rounded-full text-[10px] sm:text-xs transition-colors border border-gray-600/50 hover:border-rose-500/50"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    {tag.name}
                  </Link>
                ))}
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

          {/* 予算サマリー */}
          {budgetSummary && budgetSummary.totalCost > 0 && (
            <div className="mb-8 theme-card rounded-lg p-4 sm:p-6">
              <h2 className="text-sm font-semibold theme-text-secondary mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {locale === 'en' ? 'Purchase Summary' : locale === 'zh' ? '购买概览' : locale === 'ko' ? '구매 요약' : '全作品購入サマリー'}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-400 mb-1">
                    {locale === 'en' ? 'Total Cost' : locale === 'zh' ? '总价' : locale === 'ko' ? '총비용' : '合計費用'}
                  </p>
                  <p className="text-lg sm:text-xl font-bold text-emerald-400">
                    ¥{budgetSummary.totalCost.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    {budgetSummary.pricedProducts}/{budgetSummary.totalProducts}
                    {locale === 'en' ? ' priced' : locale === 'zh' ? ' 已知价格' : locale === 'ko' ? ' 가격확인' : '作品'}
                  </p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-400 mb-1">
                    {locale === 'en' ? 'Avg Price' : locale === 'zh' ? '平均单价' : locale === 'ko' ? '평균가격' : '平均単価'}
                  </p>
                  <p className="text-lg sm:text-xl font-bold theme-text">
                    ¥{budgetSummary.avgPrice.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    ¥{budgetSummary.minPrice.toLocaleString()} ~ ¥{budgetSummary.maxPrice.toLocaleString()}
                  </p>
                </div>
                {budgetSummary.onSaleCount > 0 && (
                  <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-400 mb-1">
                      {locale === 'en' ? 'On Sale' : locale === 'zh' ? '促销中' : locale === 'ko' ? '세일 중' : 'セール中'}
                    </p>
                    <p className="text-lg sm:text-xl font-bold text-rose-400">
                      {budgetSummary.onSaleCount}
                      <span className="text-sm ml-0.5">
                        {locale === 'en' ? 'items' : locale === 'zh' ? '件' : locale === 'ko' ? '건' : '作品'}
                      </span>
                    </p>
                  </div>
                )}
                {budgetSummary.totalSavings > 0 && (
                  <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-400 mb-1">
                      {locale === 'en' ? 'Savings' : locale === 'zh' ? '可省' : locale === 'ko' ? '절약' : 'セール割引額'}
                    </p>
                    <p className="text-lg sm:text-xl font-bold text-yellow-400">
                      -¥{budgetSummary.totalSavings.toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
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
