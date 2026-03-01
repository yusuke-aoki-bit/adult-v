import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import ProductCard from '@/components/ProductCard';
import {
  ActressHeroImage,
  Pagination,
  CrossAspInfo,
  ActressAiReview,
  PerformerTopProducts,
  PerformerOnSaleProducts,
  SectionVisibility,
  SocialShareButtons,
} from '@adult-v/shared/components';
import { JsonLD } from '@/components/JsonLD';
import Breadcrumb from '@/components/Breadcrumb';
import {
  getCachedActressById,
  getProducts,
  getProductsCount,
  getTagsForActress,
  getPerformerAliases,
  getActressProductCountByAsp,
  getTagById,
  getActressCareerAnalysis,
  getActressBudgetSummary,
} from '@/lib/db/queries';
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

// ISR: locale明示でheaders()回避済み → パブリックキャッシュ有効
export const revalidate = 60;

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

const DEFAULT_PER_PAGE = 48;
const VALID_PER_PAGE = [12, 24, 48, 96];

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  try {
    const { performerId, locale } = await params;
    const resolvedSearchParams = await searchParams;
    const actress = await getCachedActressById(performerId, locale);
    if (!actress) return {};

    const t = await getTranslations({ locale, namespace: 'actress' });
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
    const firstTagId =
      typeof includeParam === 'string'
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
          const tagName =
            locale === 'en'
              ? tag.nameEn || tag.name
              : locale === 'zh'
                ? tag.nameZh || tag.name
                : locale === 'ko'
                  ? tag.nameKo || tag.name
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
        ja: `${baseUrl}${actressPath}`,
        en: `${baseUrl}${actressPath}?hl=en`,
        zh: `${baseUrl}${actressPath}?hl=zh`,
        'zh-TW': `${baseUrl}${actressPath}?hl=zh-TW`,
        ko: `${baseUrl}${actressPath}?hl=ko`,
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
      getTranslations({ locale, namespace: 'actress' }),
      getTranslations({ locale, namespace: 'filter' }),
      getTranslations({ locale, namespace: 'nav' }),
      getTranslations({ locale, namespace: 'performerTopProducts' }),
      getTranslations({ locale, namespace: 'performerOnSale' }),
      getCachedActressById(performerId, locale),
    ]);
  } catch (error) {
    console.error(`[actress-detail] Error loading performer ${performerId}:`, error);
    notFound();
  }
  if (!actress) notFound();

  const page = Math.max(1, Math.min(parseInt(resolvedSearchParams.page || '1', 10), 500));
  const sortBy = (resolvedSearchParams.sort || 'releaseDateDesc') as
    | 'releaseDateDesc'
    | 'releaseDateAsc'
    | 'priceDesc'
    | 'priceAsc'
    | 'titleAsc';

  // 表示件数（URLパラメータから取得、無効な値はデフォルトに）
  const perPageParam = parseInt(resolvedSearchParams.perPage || '', 10);
  const perPage = VALID_PER_PAGE.includes(perPageParam) ? perPageParam : DEFAULT_PER_PAGE;

  // hasVideo/hasImageフィルター
  const hasVideo = resolvedSearchParams.hasVideo === 'true';
  const hasImage = resolvedSearchParams.hasImage === 'true';
  const performerType = resolvedSearchParams.performerType as 'solo' | 'multi' | undefined;

  // Get include and exclude tags
  const includeTags =
    typeof resolvedSearchParams.include === 'string'
      ? resolvedSearchParams.include.split(',').filter(Boolean)
      : Array.isArray(resolvedSearchParams.include)
        ? resolvedSearchParams.include
        : [];
  const excludeTags =
    typeof resolvedSearchParams.exclude === 'string'
      ? resolvedSearchParams.exclude.split(',').filter(Boolean)
      : Array.isArray(resolvedSearchParams.exclude)
        ? resolvedSearchParams.exclude
        : [];

  // Get ASP filter
  const includeAsps =
    typeof resolvedSearchParams.asp === 'string'
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
  const nonPrimaryAliases = aliases.filter((alias) => !alias.isPrimary);

  const basePath = localizedHref(`/actress/${actress.id}`, locale);

  // Structured data with enhanced Person Schema
  // aiReviewがオブジェクト型の場合は空文字列を使用
  const aiReviewText = typeof actress.aiReview === 'string' ? actress.aiReview : '';
  // exactOptionalPropertyTypes対応: undefinedを含むプロパティは条件付きで追加
  const personSchemaOptions: { workCount: number; aliases: string[]; debutYear?: number; sameAs?: string[] } = {
    workCount: total,
    aliases: nonPrimaryAliases.map((a) => a.aliasName),
  };
  if (careerAnalysis?.debutYear != null) {
    personSchemaOptions.debutYear = careerAnalysis.debutYear;
  }

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
  const worksSchema =
    works.length > 0
      ? generateItemListSchema(
          works.map((w) => ({ name: w.title, url: localizedHref(`/products/${w.id}`, locale) })),
          t('filmography'),
        )
      : null;

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
    actressFaqOptions.aliases = nonPrimaryAliases.map((a) => a.aliasName);
  }
  if (genreTags.length > 0) {
    actressFaqOptions.topGenres = genreTags.slice(0, 5).map((t) => t.name);
  }
  if (productCountByAsp.length > 0) {
    actressFaqOptions.aspNames = productCountByAsp.map((a) => a.aspName);
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

      <main className="theme-body min-h-screen">
        {/* セクションナビゲーション */}
        <ActressSectionNav
          locale={locale}
          hasAiReview={!!actress.aiReview}
          hasCareerAnalysis={!!careerAnalysis}
          hasTopProducts={topProducts.length > 0}
          hasOnSaleProducts={onSaleProducts.length > 0}
        />

        <div className="container mx-auto px-4 py-4 sm:py-6">
          {/* Breadcrumb + PR */}
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
            <Breadcrumb items={[{ label: tNav('home'), href: localizedHref('/', locale) }, { label: actress.name }]} />
            <span className="theme-text-muted text-[11px]">
              <span className="mr-1 rounded bg-yellow-900/30 px-1 py-px font-bold text-yellow-400">PR</span>
              広告・アフィリエイトリンク含む
            </span>
          </div>

          {/* Header */}
          <div id="profile" className="mb-4 sm:mb-5">
            <div className="flex items-start gap-3 sm:gap-4">
              <ActressHeroImage
                src={actress.heroImage || actress.thumbnail}
                alt={actress.name}
                size={64}
                className="h-14 w-14 shrink-0 sm:h-16 sm:w-16"
                priority
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="theme-text truncate text-xl font-bold sm:text-2xl">
                    {actress.name}
                    <span className="ml-2 text-base font-normal text-gray-400 sm:text-lg">
                      {locale === 'en'
                        ? `- AV Actress | ${total} Videos`
                        : locale === 'zh'
                          ? `- AV女优 | 共${total}部作品`
                          : locale === 'ko'
                            ? `- AV여배우 | ${total}편`
                            : `- AV女優 | 全${total}作品`}
                    </span>
                  </h1>
                  <ActressFavoriteButton
                    id={actress.id}
                    name={actress.name}
                    thumbnail={actress.heroImage || actress.thumbnail || ''}
                  />
                </div>
                <p className="theme-text-secondary text-sm sm:text-base">{t('totalProducts', { count: total })}</p>
                {/* SNSシェアボタン */}
                <div className="mt-2">
                  <SocialShareButtons
                    title={`${actress.name} - ${t('totalProducts', { count: total })}`}
                    compact
                    hashtags={['AV女優', actress.name.replace(/\s/g, '')]}
                  />
                </div>
                {nonPrimaryAliases.length > 0 && (
                  <p className="theme-text-muted mt-1 truncate text-xs sm:text-sm">
                    {t('aliases')}: {nonPrimaryAliases.map((a) => a.aliasName).join(', ')}
                  </p>
                )}
              </div>
            </div>
            {/* ASP別作品数バッジ */}
            {productCountByAsp.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {productCountByAsp.map((asp) => {
                  const providerId = ASP_TO_PROVIDER_ID[asp.aspName];
                  const meta = providerId ? providerMeta[providerId] : null;
                  const colors = meta?.gradientColors || { from: '#4b5563', to: '#374151' };
                  return (
                    <span
                      key={asp.aspName}
                      className="rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-white sm:text-xs"
                      style={{ background: `linear-gradient(to right, ${colors.from}, ${colors.to})` }}
                    >
                      {meta?.label || asp.aspName}: {asp.count}
                    </span>
                  );
                })}
              </div>
            )}
            {/* 人気ジャンルリンク（回遊促進） */}
            {genreTags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {genreTags.slice(0, 8).map((tag) => (
                  <Link
                    key={tag.id}
                    href={localizedHref(`/tags/${tag.id}`, locale)}
                    className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-gray-300 transition-colors hover:border-fuchsia-500/50 hover:bg-fuchsia-600/30 hover:text-fuchsia-300 sm:text-xs"
                  >
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                      />
                    </svg>
                    {tag.name}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* SEO: サーバーレンダリングされるプロフィールテキスト（Googlebot向け） */}
          <section className="theme-card mb-5 rounded-lg p-4">
            <h2 className="theme-text mb-2 text-sm font-semibold">
              {locale === 'en'
                ? `About ${actress.name}`
                : locale === 'zh'
                  ? `关于${actress.name}`
                  : locale === 'ko'
                    ? `${actress.name} 소개`
                    : `${actress.name}について`}
            </h2>
            <p className="text-sm leading-relaxed text-gray-400">
              {locale === 'en'
                ? `${actress.name} is a Japanese AV actress${careerAnalysis?.debutYear ? ` who debuted in ${careerAnalysis.debutYear}` : ''}. She has appeared in ${total} titles${productCountByAsp.length > 0 ? ` available on ${productCountByAsp.map((a) => a.aspName).join(', ')}` : ''}.${
                    genreTags.length > 0
                      ? ` Her popular genres include ${genreTags
                          .slice(0, 5)
                          .map((t) => t.name)
                          .join(', ')}.`
                      : ''
                  }${nonPrimaryAliases.length > 0 ? ` Also known as: ${nonPrimaryAliases.map((a) => a.aliasName).join(', ')}.` : ''}`
                : locale === 'zh'
                  ? `${actress.name}是日本AV女优${careerAnalysis?.debutYear ? `，${careerAnalysis.debutYear}年出道` : ''}。共出演${total}部作品${productCountByAsp.length > 0 ? `，可在${productCountByAsp.map((a) => a.aspName).join('、')}等平台观看` : ''}。${
                      genreTags.length > 0
                        ? `擅长类型：${genreTags
                            .slice(0, 5)
                            .map((t) => t.name)
                            .join('、')}。`
                        : ''
                    }${nonPrimaryAliases.length > 0 ? `别名：${nonPrimaryAliases.map((a) => a.aliasName).join('、')}。` : ''}`
                  : locale === 'ko'
                    ? `${actress.name}은(는) 일본 AV여배우${careerAnalysis?.debutYear ? `로 ${careerAnalysis.debutYear}년에 데뷔` : ''}했습니다. 총 ${total}편의 작품에 출연${productCountByAsp.length > 0 ? `하였으며 ${productCountByAsp.map((a) => a.aspName).join(', ')}에서 시청 가능` : ''}합니다.${
                        genreTags.length > 0
                          ? ` 인기 장르: ${genreTags
                              .slice(0, 5)
                              .map((t) => t.name)
                              .join(', ')}.`
                          : ''
                      }${nonPrimaryAliases.length > 0 ? ` 다른 이름: ${nonPrimaryAliases.map((a) => a.aliasName).join(', ')}.` : ''}`
                    : `${actress.name}はAV女優${careerAnalysis?.debutYear ? `で、${careerAnalysis.debutYear}年にデビュー` : ''}。出演作品は全${total}本${productCountByAsp.length > 0 ? `で、${productCountByAsp.map((a) => a.aspName).join('・')}等で視聴可能` : ''}です。${
                        genreTags.length > 0
                          ? `人気ジャンル：${genreTags
                              .slice(0, 5)
                              .map((t) => t.name)
                              .join('・')}。`
                          : ''
                      }${nonPrimaryAliases.length > 0 ? `別名義：${nonPrimaryAliases.map((a) => a.aliasName).join('・')}。` : ''}${careerAnalysis && !careerAnalysis.isActive ? `${careerAnalysis.latestYear || ''}年頃に活動を終了しています。` : ''}`}
            </p>
          </section>

          {/* 卒業/引退アラート */}
          {careerAnalysis && (
            <div className="mb-4">
              <RetirementAlert career={careerAnalysis} actressName={actress.name} locale={locale} />
            </div>
          )}

          {/* 予算サマリー */}
          {budgetSummary && budgetSummary.totalCost > 0 && (
            <div className="theme-card mb-5 rounded-lg p-3 sm:p-4">
              <h2 className="theme-text-secondary mb-3 flex items-center gap-2 text-sm font-semibold">
                <svg className="h-4 w-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {locale === 'en'
                  ? 'Purchase Summary'
                  : locale === 'zh'
                    ? '购买概览'
                    : locale === 'ko'
                      ? '구매 요약'
                      : '全作品購入サマリー'}
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg bg-white/5 p-3 text-center ring-1 ring-white/10">
                  <p className="mb-1 text-xs text-gray-400">
                    {locale === 'en'
                      ? 'Total Cost'
                      : locale === 'zh'
                        ? '总价'
                        : locale === 'ko'
                          ? '총비용'
                          : '合計費用'}
                  </p>
                  <p className="text-lg font-bold text-emerald-400 sm:text-xl">
                    ¥{budgetSummary.totalCost.toLocaleString()}
                  </p>
                  <p className="mt-0.5 text-[11px] text-gray-500">
                    {budgetSummary.pricedProducts}/{budgetSummary.totalProducts}
                    {locale === 'en'
                      ? ' priced'
                      : locale === 'zh'
                        ? ' 已知价格'
                        : locale === 'ko'
                          ? ' 가격확인'
                          : '作品'}
                  </p>
                </div>
                <div className="rounded-lg bg-white/5 p-3 text-center ring-1 ring-white/10">
                  <p className="mb-1 text-xs text-gray-400">
                    {locale === 'en'
                      ? 'Avg Price'
                      : locale === 'zh'
                        ? '平均单价'
                        : locale === 'ko'
                          ? '평균가격'
                          : '平均単価'}
                  </p>
                  <p className="theme-text text-lg font-bold sm:text-xl">¥{budgetSummary.avgPrice.toLocaleString()}</p>
                  <p className="mt-0.5 text-[11px] text-gray-500">
                    ¥{budgetSummary.minPrice.toLocaleString()} ~ ¥{budgetSummary.maxPrice.toLocaleString()}
                  </p>
                </div>
                {budgetSummary.onSaleCount > 0 && (
                  <div className="rounded-lg bg-white/5 p-3 text-center ring-1 ring-white/10">
                    <p className="mb-1 text-xs text-gray-400">
                      {locale === 'en'
                        ? 'On Sale'
                        : locale === 'zh'
                          ? '促销中'
                          : locale === 'ko'
                            ? '세일 중'
                            : 'セール中'}
                    </p>
                    <p className="text-lg font-bold text-fuchsia-400 sm:text-xl">
                      {budgetSummary.onSaleCount}
                      <span className="ml-0.5 text-sm">
                        {locale === 'en' ? 'items' : locale === 'zh' ? '件' : locale === 'ko' ? '건' : '作品'}
                      </span>
                    </p>
                  </div>
                )}
                {budgetSummary.totalSavings > 0 && (
                  <div className="rounded-lg bg-white/5 p-3 text-center ring-1 ring-white/10">
                    <p className="mb-1 text-xs text-gray-400">
                      {locale === 'en'
                        ? 'Savings'
                        : locale === 'zh'
                          ? '可省'
                          : locale === 'ko'
                            ? '절약'
                            : 'セール割引額'}
                    </p>
                    <p className="text-lg font-bold text-yellow-400 sm:text-xl">
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
              <div id="ai-review" className="mb-5">
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
          <div className="mb-5">
            <AiActressProfileWrapper actressId={actress.id} locale={locale} />
          </div>

          {/* クロスASP情報表示 */}
          {(aliases.length > 0 || productCountByAsp.length > 1) && (
            <div className="mb-5">
              <CrossAspInfo
                performerId={parseInt(actress.id)}
                performerName={actress.name}
                aliases={aliases}
                aspCounts={productCountByAsp}
                locale={locale}
                hideFanzaLink
              />
            </div>
          )}

          {/* キャリア分析セクション */}
          {careerAnalysis && (
            <SectionVisibility sectionId="career" pageId="actress" locale={locale}>
              <div id="career" className="mb-5">
                <ActressCareerTimeline career={careerAnalysis} actressName={actress.name} locale={locale} />
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
                  hideFanzaPurchaseLinks={true}
                  translations={{
                    title: tOnSale('title', { name: actress.name }),
                    description: tOnSale('description'),
                    off: tOnSale('off'),
                    endsIn: tOnSale('endsIn'),
                    endsTomorrow: tOnSale('endsTomorrow'),
                    endsToday: tOnSale('endsToday'),
                    yen: tOnSale('yen'),
                    buyNow: tOnSale('buyNow'),
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

              {/* ソートドロップダウン・表示件数 */}
              <div className="mb-2 flex items-center justify-end gap-4">
                <PerPageDropdown perPage={perPage} basePath={basePath} />
                <ProductSortDropdown sortBy={sortBy} basePath={basePath} />
              </div>

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
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
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
                <p className="theme-text-muted py-12 text-center">{t('noProducts')}</p>
              )}
            </div>
          </SectionVisibility>

          {/* 共演者マップ（インタラクティブ） */}
          <SectionVisibility sectionId="costar-network" pageId="actress" locale={locale}>
            <div id="costar-network" className="mt-6 mb-5">
              <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-white/5" />}>
                <PerformerRelationMap performerId={parseInt(actress.id)} locale={locale} />
              </Suspense>
            </div>
          </SectionVisibility>

          {/* 類似女優マップ（ジャンル・メーカー・プロフィール複合スコア） */}
          <SectionVisibility sectionId="similar-network" pageId="actress" locale={locale}>
            <div id="similar-network" className="mb-5">
              <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-white/5" />}>
                <SimilarPerformerMap performerId={parseInt(actress.id)} locale={locale} />
              </Suspense>
            </div>
          </SectionVisibility>
        </div>
      </main>
    </>
  );
}
