import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import nextDynamic from 'next/dynamic';
import { JsonLD } from '@/components/JsonLD';
import ProductImageGallery from '@/components/ProductImageGallery';
import Breadcrumb, { type BreadcrumbItem } from '@/components/Breadcrumb';

// LCP最適化: ProductVideoPlayerを遅延読み込み（ファーストビュー外なので初期バンドルから除外）
const ProductVideoPlayer = nextDynamic(() => import('@/components/ProductVideoPlayer'), {
  loading: () => (
    <div className="theme-accordion-bg theme-text-muted flex h-48 animate-pulse items-center justify-center rounded-lg">
      Loading video...
    </div>
  ),
});
import ProductActions from '@/components/ProductActions';
import {
  ViewTracker,
  PriceComparisonServer,
  FanzaCrossLink,
  productDetailTranslations,
  CopyButton,
} from '@adult-v/shared/components';
import StickyCta from '@/components/StickyCta';
import AffiliateClickTracker from '@/components/AffiliateClickTracker';
import AiProductDescriptionWrapper from '@/components/AiProductDescriptionWrapper';
import ExpandableText from '@/components/ExpandableText';
import AlsoViewedWrapper from '@/components/AlsoViewedWrapper';
import RelatedProductsTabs from '@/components/RelatedProductsTabs';
import ProductAnalysisTabs from '@/components/ProductAnalysisTabs';
import ProductSectionNav from '@/components/ProductSectionNav';
import {
  getCachedProductByIdOrCode,
  getProductSources,
  getActressAvgPricePerMin,
  getSampleImagesByMakerCode,
  getProductMakerCode,
  getAllProductSources,
} from '@/lib/db/queries';
import { formatProductCodeForDisplay } from '@adult-v/shared';
import { isSubscriptionSite } from '@adult-v/shared/lib/image-utils';
import {
  getPerformerOtherProducts,
  getProductMaker,
  getSameMakerProducts,
  getProductGenreTags,
  getProductSeries,
  getSameSeriesProducts,
} from '@/lib/db/recommendations';
import {
  generateBaseMetadata,
  generateProductSchema,
  generateBreadcrumbSchema,
  generateOptimizedDescription,
  generateVideoObjectSchema,
  generateFAQSchema,
  getProductPageFAQs,
  generateReviewSchema,
  generateHowToSchema,
  generateAggregateOfferSchema,
} from '@/lib/seo';
import { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { localizedHref } from '@adult-v/shared/i18n';

// force-dynamic: next-intlのgetTranslationsがheaders()を内部呼出しするためISR不可
export const dynamic = 'force-dynamic';

/**
 * 配列をシャッフル（Fisher-Yates algorithm）
 * seed値を使って同じページビューでは同じ順序を保持
 */
function shuffleArray<T>(array: T[], seed: number): T[] {
  const result = [...array];
  let m = result.length;
  while (m) {
    const i = Math.floor(seededRandom(seed + m) * m--);
    const temp = result[m];
    result[m] = result[i] as T;
    result[i] = temp as T;
  }
  return result;
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

interface PageProps {
  params: Promise<{ id: string; locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const { id, locale } = await params;
    const product = await getCachedProductByIdOrCode(id, locale);
    if (!product) return {};

    const baseUrl = process.env['NEXT_PUBLIC_SITE_URL'] || 'https://example.com';

    // SEO最適化されたメタディスクリプション生成（セール・レーティング情報含む）
    // 表示用品番を優先（SSIS-865 > ssis865）→ Google検索で品番ヒット改善
    const displayCode = product.makerProductCode || product.normalizedProductId || String(product.id);
    const optimizedDescription = generateOptimizedDescription(
      product.title,
      product.actressName,
      product.tags,
      product.releaseDate,
      displayCode,
      {
        ...(product.salePrice != null && { salePrice: product.salePrice }),
        ...(product.regularPrice != null && { regularPrice: product.regularPrice }),
        ...(product.discount != null && { discount: product.discount }),
        ...(product.rating != null && { rating: product.rating }),
        ...(product.reviewCount != null && { reviewCount: product.reviewCount }),
        ...(product.duration != null && { duration: product.duration }),
        ...(product.provider != null && { provider: product.providerLabel || product.provider }),
        ...(product.sampleVideos &&
          product.sampleVideos.length > 0 && { sampleVideoCount: product.sampleVideos.length }),
        locale,
      },
    );

    // SEO: Titleに表示用品番を含める（Google検索で品番検索時にヒットさせる）
    // セール時は割引率を含めてCTR向上
    const salePrefix = product.discount && product.discount > 0 ? `【${product.discount}%OFF】` : '';
    const seoTitle = salePrefix + (displayCode ? `${displayCode} ${product.title}` : product.title);

    // canonical URLは全言語で統一（パラメータなし）
    const productPath = `/products/${product.id}`;
    const canonicalUrl = `${baseUrl}${productPath}`;

    return {
      ...generateBaseMetadata(
        seoTitle,
        optimizedDescription,
        product.imageUrl,
        localizedHref(`/products/${product.id}`, locale),
        undefined,
        locale,
      ),
      alternates: {
        canonical: canonicalUrl,
        languages: {
          ja: `${baseUrl}${productPath}`,
          en: `${baseUrl}${productPath}?hl=en`,
          zh: `${baseUrl}${productPath}?hl=zh`,
          'zh-TW': `${baseUrl}${productPath}?hl=zh-TW`,
          ko: `${baseUrl}${productPath}?hl=ko`,
          'x-default': `${baseUrl}${productPath}`,
        },
      },
    };
  } catch {
    return {};
  }
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { id, locale } = await params;

  // Parallel fetch translations and product data
  let tNav, tCommon, tRelated, product;
  try {
    [tNav, tCommon, tRelated, product] = await Promise.all([
      getTranslations('nav'),
      getTranslations('common'),
      getTranslations('relatedProducts'),
      getCachedProductByIdOrCode(id, locale),
    ]);
  } catch (error) {
    console.error(`[product-detail] Error loading product ${id}:`, error);
    notFound();
  }
  const t = productDetailTranslations[locale as keyof typeof productDetailTranslations] || productDetailTranslations.ja;
  if (!product) notFound();

  // 品番でアクセスした場合でもリダイレクトしない（SEO: Google検索で品番URLがインデックスされる）
  // canonical URLで正規URLを指定（重複コンテンツ対策）
  // これにより /products/SSIS-865 でもページが表示され、Googleにインデックスされる

  const basePath = localizedHref(`/products/${product.id}`, locale);

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: tNav('home'), url: localizedHref('/', locale) },
    { name: product.title, url: basePath },
  ]);

  // VideoObject Schema（サンプル動画がある場合）
  const firstVideo = product.sampleVideos?.[0];
  const videoSchema = firstVideo
    ? generateVideoObjectSchema(
        product.title,
        product.description || `${product.title}のサンプル動画`,
        product.imageUrl,
        firstVideo.url,
        product.duration,
        product.releaseDate,
      )
    : null;

  // Review Schema（AIレビューがある場合）
  let reviewSchema = null;
  if (product.aiReview) {
    const reviewOptions: Parameters<typeof generateReviewSchema>[3] = {};
    if (product.rating != null) reviewOptions.ratingValue = product.rating;
    if (product.imageUrl) reviewOptions.productImage = product.imageUrl;
    if (product.normalizedProductId) reviewOptions.productId = product.normalizedProductId;
    if (product.releaseDate) reviewOptions.datePublished = product.releaseDate;
    reviewSchema = generateReviewSchema(product.aiReview, product.title, basePath, reviewOptions);
  }

  // HowTo Schema（視聴方法ガイド - リッチスニペット表示）
  const howToSchema =
    product.providerLabel && product.affiliateUrl
      ? generateHowToSchema(product.title, product.providerLabel, product.affiliateUrl, locale)
      : null;

  // パンくずリスト用のアイテム作成（SEO・ナビゲーション強化）
  const breadcrumbItems: BreadcrumbItem[] = [{ label: tNav('home'), href: localizedHref('/', locale) }];

  // プロバイダー（配信元）を追加
  if (product.providerLabel) {
    breadcrumbItems.push({
      label: product.providerLabel,
      href: localizedHref(`/products?provider=${product.provider}`, locale),
    });
  }

  // 複数女優の場合、それぞれのパンくずリストを追加
  const mainPerformer = product.performers?.[0];
  if (mainPerformer) {
    // メイン女優のみ表示（パンくずが長くなりすぎないように）
    breadcrumbItems.push({
      label: mainPerformer.name,
      href: localizedHref(`/actress/${mainPerformer.id}`, locale),
    });
  } else if (product.actressName && product.actressId) {
    breadcrumbItems.push({
      label: product.actressName,
      href: localizedHref(`/actress/${product.actressId}`, locale),
    });
  }

  // 最後に商品タイトル（品番付き）を追加（リンクなし）
  // originalProductIdを正規化して表示用品番を生成
  // 優先順位: makerProductCode > formatProductCodeForDisplay(originalProductId) > normalizedProductId
  const formattedCode = formatProductCodeForDisplay(product.originalProductId);
  const displayProductCode = product.makerProductCode || formattedCode || product.normalizedProductId;
  const displayTitle = displayProductCode
    ? displayProductCode
    : product.title.length > 30
      ? product.title.substring(0, 30) + '...'
      : product.title;
  breadcrumbItems.push({ label: displayTitle });

  // E-E-A-T強化: 関連データを並列取得（パフォーマンス最適化）
  const productId = typeof product.id === 'string' ? parseInt(product.id) : product.id;
  const primaryPerformerId = product.performers?.[0]?.id || product.actressId;
  const primaryPerformerName = product.performers?.[0]?.name || product.actressName;
  const actressId = product.actressId || product.performers?.[0]?.id;

  // Phase 1: 基本データの並列取得
  let maker, series, genreTags, sources, makerProductCode;
  try {
    [maker, series, genreTags, sources, makerProductCode] = await Promise.all([
      getProductMaker(productId),
      getProductSeries(productId),
      getProductGenreTags(productId),
      getProductSources(productId),
      getProductMakerCode(productId),
    ]);
  } catch (error) {
    console.error(`[product-detail] Error loading product data phase 1 for ${id}:`, error);
    notFound();
  }

  // Structured data（レーティング情報含む + 外部ID）
  const productSchema = generateProductSchema(
    product.title,
    product.description || '',
    product.imageUrl,
    basePath,
    product.regularPrice || product.price,
    product.providerLabel,
    product.rating && product.reviewCount
      ? {
          ratingValue: product.rating,
          reviewCount: product.reviewCount,
        }
      : undefined,
    product.salePrice,
    'JPY',
    product.normalizedProductId || undefined,
    // SEO: 外部品番（FANZA ID等）を構造化データに追加
    sources
      ?.filter(
        (s: { originalProductId: string | null }) =>
          s.originalProductId && s.originalProductId !== product.normalizedProductId,
      )
      .map((s: { aspName: string; originalProductId: string | null }) => ({
        aspName: s.aspName,
        originalProductId: s.originalProductId!,
      })),
  );

  // FAQ Schema（商品ページ用 + 外部品番FAQ）
  const externalIdsForFaq =
    sources
      ?.filter(
        (s: { originalProductId: string | null }) =>
          s.originalProductId && s.originalProductId !== product.normalizedProductId,
      )
      .map((s: { aspName: string; originalProductId: string | null }) => ({
        aspName: s.aspName,
        originalProductId: s.originalProductId!,
      })) || [];
  const productFaqs = getProductPageFAQs(locale, {
    productId: product.normalizedProductId || undefined,
    title: product.title,
    duration: product.duration,
    releaseDate: product.releaseDate,
    provider: product.providerLabel,
    actressName: product.actressName || product.performers?.[0]?.name,
    isHD: true,
    makerProductCode: displayProductCode || undefined,
    ...(externalIdsForFaq.length > 0 && { externalIds: externalIdsForFaq }),
  });
  const faqSchema = generateFAQSchema(productFaqs);

  // Phase 2: Phase 1の結果に依存するデータの並列取得
  let performerOtherProducts,
    sameMakerProducts,
    sameSeriesProducts,
    sourcesWithSales,
    crossAspSampleImages,
    actressAvgPricePerMin;
  try {
    [
      performerOtherProducts,
      sameMakerProducts,
      sameSeriesProducts,
      sourcesWithSales,
      crossAspSampleImages,
      actressAvgPricePerMin,
    ] = await Promise.all([
      primaryPerformerId
        ? getPerformerOtherProducts(Number(primaryPerformerId), String(product.id), 6)
        : Promise.resolve([]),
      maker ? getSameMakerProducts(maker.id, productId, 6) : Promise.resolve([]),
      series ? getSameSeriesProducts(series.id, productId, 6) : Promise.resolve([]),
      getAllProductSources(productId, product.title, makerProductCode),
      makerProductCode ? getSampleImagesByMakerCode(makerProductCode) : Promise.resolve([]),
      actressId ? getActressAvgPricePerMin(String(actressId)) : Promise.resolve(null),
    ]);
  } catch (error) {
    console.error(`[product-detail] Error loading product data phase 2 for ${id}:`, error);
    notFound();
  }

  // AggregateOffer Schema（複数ASP価格比較 - リッチスニペット表示）
  const aggregateOfferSchema =
    sourcesWithSales.length > 1
      ? generateAggregateOfferSchema(
          sourcesWithSales.map((source) => {
            const offer: {
              providerName: string;
              price: number;
              salePrice?: number;
              url: string;
              availability?: 'InStock' | 'OutOfStock';
              saleEndAt?: string;
            } = {
              providerName: source.aspName,
              price: source.regularPrice ?? 0,
              url: source.affiliateUrl || '',
              availability: 'InStock',
            };
            if (source.salePrice != null) offer.salePrice = source.salePrice;
            if (source.saleEndAt) offer.saleEndAt = new Date(source.saleEndAt).toISOString();
            return offer;
          }),
          'JPY',
        )
      : null;

  return (
    <>
      <JsonLD data={productSchema} />
      <JsonLD data={breadcrumbSchema} />
      {videoSchema && <JsonLD data={videoSchema} />}
      <JsonLD data={faqSchema} />
      {reviewSchema && <JsonLD data={reviewSchema} />}
      {howToSchema && <JsonLD data={howToSchema} />}
      {aggregateOfferSchema && <JsonLD data={aggregateOfferSchema} />}

      <div className="theme-body min-h-screen">
        {/* セクションナビゲーション */}
        <ProductSectionNav
          locale={locale}
          hasSampleVideo={!!(product.sampleVideos && product.sampleVideos.length > 0)}
          hasPriceComparison={sourcesWithSales.length > 0}
          hasAnalysis={true}
          hasRelatedProducts={
            performerOtherProducts.length > 0 || sameSeriesProducts.length > 0 || sameMakerProducts.length > 0
          }
          hasAlsoViewed={true}
        />

        <div className="container mx-auto px-4 py-8">
          {/* パンくずリスト */}
          <Breadcrumb items={breadcrumbItems} className="mb-4" />

          {/* PR表記（景品表示法・ステマ規制対応） */}
          <p className="theme-text-muted mb-6 text-xs">
            <span className="mr-1.5 rounded bg-yellow-900/30 px-1.5 py-0.5 font-bold text-yellow-400">PR</span>
            当ページには広告・アフィリエイトリンクが含まれています
          </p>

          {/* サンプル動画セクション */}
          {product.sampleVideos && product.sampleVideos.length > 0 && (
            <details
              id="sample-video"
              className="theme-content theme-border group mb-6 scroll-mt-20 rounded-lg border shadow-md"
              open
            >
              <summary className="theme-accordion-hover flex cursor-pointer list-none items-center gap-2 rounded-lg p-4 transition-colors">
                <svg className="theme-text-accent h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="theme-text flex-1 text-lg font-semibold">
                  サンプル動画 ({product.sampleVideos.length}本)
                </span>
                <svg
                  className="theme-text-muted h-5 w-5 transition-transform group-open:rotate-180"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="p-6 pt-2">
                <ProductVideoPlayer sampleVideos={product.sampleVideos} productTitle={product.title} />
              </div>
            </details>
          )}

          <div
            id="product-info"
            className="theme-content theme-border scroll-mt-20 overflow-hidden rounded-lg border shadow-md"
          >
            <div className="grid grid-cols-1 gap-8 p-6 md:grid-cols-2">
              {/* Product Image Gallery */}
              <ProductImageGallery
                mainImage={product.imageUrl ?? null}
                sampleImages={product.sampleImages ?? []}
                productTitle={product.title}
                crossAspImages={crossAspSampleImages}
              />

              {/* Product Info */}
              <div className="space-y-6">
                <div>
                  <div className="mb-2 flex items-start gap-3">
                    {/* SEO強化: H1に品番を含める（Google検索で品番検索時にヒット率向上） */}
                    {/* 正規化された品番を使用 */}
                    <h1 className="theme-text flex-1 text-3xl font-bold">
                      {displayProductCode && <span className="text-rose-400">{displayProductCode}</span>}
                      {displayProductCode && ' '}
                      {product.title}
                    </h1>
                    <ProductActions
                      productId={productId}
                      title={product.title}
                      imageUrl={product.imageUrl ?? null}
                      provider={product.provider || ''}
                      performerName={product.actressName || product.performers?.[0]?.name || ''}
                      performerId={product.actressId || product.performers?.[0]?.id || ''}
                      tags={product.tags ?? []}
                      duration={product.duration ?? 0}
                      locale={locale}
                    />
                  </div>
                  <p className="theme-text-secondary">{product.providerLabel}</p>
                  {/* SEO強化: 品番を目立つ形で表示 + コピーボタン */}
                  {/* 正規化された品番を使用 */}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <div className="inline-flex items-center gap-1">
                      <span className="inline-flex items-center rounded-md border border-rose-700 bg-rose-900/50 px-3 py-1 font-mono text-sm text-rose-200">
                        {displayProductCode || product.id}
                      </span>
                      <CopyButton text={displayProductCode || String(product.id)} label="品番" iconOnly size="xs" />
                    </div>
                    <div className="inline-flex items-center gap-1">
                      <CopyButton text={product.title} label="タイトル" size="xs" />
                    </div>
                  </div>
                  {/* レビュー統計サマリー */}
                  {product.rating && product.rating > 0 && (
                    <div className="theme-accordion-bg mt-3 flex items-center gap-3 rounded-lg p-3">
                      <div className="flex items-center gap-1">
                        <svg className="h-6 w-6 fill-current text-yellow-400" viewBox="0 0 24 24">
                          <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                        </svg>
                        <span className="text-2xl font-bold text-yellow-400">{product.rating.toFixed(1)}</span>
                      </div>
                      {product.reviewCount && product.reviewCount > 0 && (
                        <span className="theme-text-secondary text-sm">
                          {product.reviewCount.toLocaleString()}件のレビュー
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {product.performers && product.performers.length > 0 ? (
                  <div className="theme-accordion-bg rounded-lg p-4">
                    <h2 className="theme-text-muted mb-3 flex items-center gap-2 text-sm font-semibold">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                      {product.performers.length === 1 ? tCommon('actress') : t.performers}
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      {/* 商品IDベースのシードでランダム化（一貫した順序を保持、ビルド時の動的値使用を回避） */}
                      {shuffleArray(product.performers, productId).map((performer) => (
                        <div key={performer.id} className="inline-flex items-center gap-1">
                          <Link
                            href={localizedHref(`/actress/${performer.id}`, locale)}
                            className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-rose-500"
                          >
                            <span>{performer.name}</span>
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </Link>
                          <CopyButton text={performer.name} iconOnly size="xs" />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : product.actressName ? (
                  <div className="theme-accordion-bg rounded-lg p-4">
                    <h2 className="theme-text-muted mb-3 flex items-center gap-2 text-sm font-semibold">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                      {tCommon('actress')}
                    </h2>
                    <div className="inline-flex items-center gap-1">
                      {product.actressId ? (
                        <Link
                          href={localizedHref(`/actress/${product.actressId}`, locale)}
                          className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-rose-500"
                        >
                          <span>{product.actressName}</span>
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      ) : (
                        <span className="text-white">{product.actressName}</span>
                      )}
                      <CopyButton text={product.actressName} iconOnly size="xs" />
                    </div>
                  </div>
                ) : null}

                {product.description && (
                  <div>
                    <h2 className="theme-text mb-2 text-sm font-semibold">{t.description}</h2>
                    <ExpandableText text={product.description} maxLines={3} className="theme-text-secondary" />
                  </div>
                )}

                {/* AI生成の作品紹介 */}
                <AiProductDescriptionWrapper productId={String(product.id)} locale={locale} />

                {product.price && (
                  <div className="theme-accordion-bg rounded-lg p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <h2 className="theme-text-muted text-sm font-semibold">{t.price}</h2>
                      {product.salePrice && product.discount && (
                        <span className="inline-flex items-center rounded bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                          {product.discount}% OFF
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-3">
                      {product.salePrice ? (
                        <>
                          <p className="text-3xl font-bold text-red-400">¥{product.salePrice.toLocaleString()}</p>
                          <p className="theme-text-muted text-lg line-through">¥{product.price.toLocaleString()}</p>
                        </>
                      ) : (
                        <p className="theme-text text-3xl font-bold">
                          {product.provider && isSubscriptionSite(product.provider) && (
                            <span className="theme-text-muted mr-1 text-base">{t.monthly}</span>
                          )}
                          ¥{product.price.toLocaleString()}
                        </p>
                      )}
                    </div>
                    {product.salePrice && product.price && product.price > product.salePrice && (
                      <div className="theme-highlight-bg mt-2 flex items-center gap-2 rounded-lg px-3 py-2">
                        <svg
                          className="h-5 w-5 shrink-0 text-emerald-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="font-bold text-emerald-500">
                          ¥{(product.price - product.salePrice).toLocaleString()} お得
                        </span>
                        <span className="theme-text-muted text-sm">({product.discount}% OFF)</span>
                      </div>
                    )}
                    {product.saleEndAt &&
                      product.salePrice &&
                      (() => {
                        const remaining = new Date(product.saleEndAt).getTime() - Date.now();
                        if (remaining <= 0) return null;
                        const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
                        const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                        const urgencyClass =
                          days < 3 ? 'text-red-400 font-bold' : days < 7 ? 'text-amber-400' : 'theme-text-muted';
                        return (
                          <p className={`mt-2 flex items-center gap-1.5 text-sm ${urgencyClass}`}>
                            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            セール終了まで: {days > 0 ? `${days}日 ` : ''}
                            {hours}時間
                          </p>
                        );
                      })()}
                    {/* ファーストビューCTA - 目立つ購入ボタン（全ASP対応） */}
                    {product.affiliateUrl && (
                      <a
                        href={product.affiliateUrl}
                        target="_blank"
                        rel="noopener noreferrer sponsored"
                        className={`mt-4 flex w-full transform items-center justify-center gap-2 rounded-xl py-4 text-lg font-bold text-white shadow-lg transition-all hover:scale-[1.02] ${
                          product.salePrice
                            ? 'bg-linear-to-r from-red-600 via-orange-500 to-red-600 shadow-red-500/30 hover:from-red-500 hover:via-orange-400 hover:to-red-500 hover:shadow-red-500/50'
                            : 'bg-linear-to-r from-rose-600 to-rose-500 shadow-rose-500/25 hover:from-rose-500 hover:to-rose-400 hover:shadow-rose-500/40'
                        }`}
                      >
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                          />
                        </svg>
                        {product.salePrice
                          ? `🔥 今すぐ${product.providerLabel}で購入`
                          : `${product.providerLabel}で購入`}
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          />
                        </svg>
                      </a>
                    )}
                    {/* 複数ASPがある場合、価格比較セクションへの誘導 */}
                    {sourcesWithSales.length > 1 && (
                      <a
                        href="#price-comparison"
                        className="theme-text-accent mt-3 flex items-center justify-center gap-1 text-sm font-medium transition-opacity hover:opacity-80"
                      >
                        他{sourcesWithSales.length - 1}社の価格を比較
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </a>
                    )}
                  </div>
                )}

                {/* インラインメタデータ行 */}
                {(product.duration || product.releaseDate) && (
                  <div className="theme-text-secondary flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    {product.duration && product.duration > 0 && <span>{Math.floor(product.duration / 60)}分</span>}
                    {product.duration && product.releaseDate && <span className="theme-text-muted">·</span>}
                    {product.releaseDate && <span>{product.releaseDate}</span>}
                  </div>
                )}

                {genreTags.length > 0 && (
                  <div>
                    <h2 className="theme-text mb-2 text-sm font-semibold">{t.tags}</h2>
                    <div className="flex flex-wrap gap-2">
                      {genreTags.map((tag) => (
                        <Link
                          key={tag.id}
                          href={localizedHref(`/tags/${tag.id}`, locale)}
                          className="theme-accordion-bg theme-text-secondary inline-flex items-center gap-1 rounded-full border border-transparent px-3 py-1 text-sm transition-colors hover:border-rose-500/40 hover:bg-rose-600/30 hover:text-rose-300"
                        >
                          {tag.name}
                          <svg
                            className="-mr-0.5 h-3.5 w-3.5 opacity-0 group-hover:opacity-100"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* シリーズ・メーカー情報 */}
                {(series || maker) && (
                  <div className="theme-accordion-bg space-y-3 rounded-lg p-4">
                    {series && (
                      <div>
                        <h2 className="theme-text-muted mb-1.5 flex items-center gap-1 text-xs font-semibold">
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                            />
                          </svg>
                          シリーズ
                        </h2>
                        <Link
                          href={localizedHref(`/series/${series.id}`, locale)}
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-rose-400 transition-colors hover:text-rose-300"
                        >
                          {series.name}
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      </div>
                    )}
                    {maker && (
                      <div>
                        <h2 className="theme-text-muted mb-1.5 flex items-center gap-1 text-xs font-semibold">
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                            />
                          </svg>
                          メーカー/レーベル
                        </h2>
                        <Link
                          href={localizedHref(`/makers/${maker.id}`, locale)}
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-rose-400 transition-colors hover:text-rose-300"
                        >
                          {maker.name}
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      </div>
                    )}
                  </div>
                )}

                {/* FANZAで見る（apps/fanza経由、直リンクは規約違反） */}
                {sources.find((s) => s.aspName?.toUpperCase() === 'FANZA') && (
                  <FanzaCrossLink
                    productId={product.normalizedProductId || product.id}
                    locale={locale}
                    className="mt-4"
                  />
                )}
              </div>
            </div>
          </div>

          {/* 価格比較セクション */}
          {sourcesWithSales.length > 0 && (
            <details
              id="price-comparison"
              className="mt-8 scroll-mt-20"
              open={sourcesWithSales.length <= 2 ? true : undefined}
            >
              <summary className="theme-text-muted mb-2 cursor-pointer list-none text-sm font-semibold hover:text-white">
                {locale === 'ja' ? '価格比較' : 'Price Comparison'} ({sourcesWithSales.length})
              </summary>
              <PriceComparisonServer sources={sourcesWithSales} locale={locale} />
            </details>
          )}

          {/* 分析セクション（AIレビュー、シーン、コスパ、投稿をタブで統合） */}
          <div id="analysis" className="mt-8 scroll-mt-20">
            <ProductAnalysisTabs
              productId={productId}
              locale={locale}
              aiReview={product.aiReview}
              rating={product.rating}
              reviewCount={product.reviewCount}
              aiReviewUpdatedAt={product.aiReviewUpdatedAt}
              price={product.price}
              salePrice={product.salePrice}
              duration={product.duration}
              actressAvgPricePerMin={actressAvgPricePerMin}
              existingTags={genreTags.map((t) => t.name)}
              existingPerformers={
                product.performers?.map((p) => p.name) || (product.actressName ? [product.actressName] : [])
              }
            />
          </div>

          {/* 関連作品（出演者/シリーズ/メーカーをタブで統合） */}
          {(performerOtherProducts.length > 0 || sameSeriesProducts.length > 0 || sameMakerProducts.length > 0) && (
            <div id="related-products" className="mt-8 scroll-mt-20">
              <RelatedProductsTabs
                locale={locale}
                tabs={[
                  ...(performerOtherProducts.length > 0 && primaryPerformerId && primaryPerformerName
                    ? [
                        {
                          key: 'performer',
                          label: tRelated('performerOtherWorks', { name: primaryPerformerName }),
                          products: performerOtherProducts,
                          viewAllHref: localizedHref(`/actress/${primaryPerformerId}`, locale),
                          viewAllLabel: tRelated('viewAll'),
                          viewMoreHref: localizedHref(`/actress/${primaryPerformerId}`, locale),
                          viewMoreLabel: tRelated('viewMore'),
                        },
                      ]
                    : []),
                  ...(sameSeriesProducts.length > 0 && series
                    ? [
                        {
                          key: 'series',
                          label: tRelated('seriesWorks', { name: series.name }),
                          products: sameSeriesProducts,
                          viewAllHref: localizedHref(`/series/${series.id}`, locale),
                          viewAllLabel: tRelated('viewAll'),
                          viewMoreHref: localizedHref(`/series/${series.id}`, locale),
                          viewMoreLabel: tRelated('viewMore'),
                        },
                      ]
                    : []),
                  ...(sameMakerProducts.length > 0 && maker
                    ? [
                        {
                          key: 'maker',
                          label: tRelated('makerOtherWorks', { name: maker.name }),
                          products: sameMakerProducts,
                          viewAllHref: localizedHref(`/makers/${maker.id}`, locale),
                          viewAllLabel: tRelated('viewAll'),
                          viewMoreHref: localizedHref(`/makers/${maker.id}`, locale),
                          viewMoreLabel: tRelated('viewMore'),
                        },
                      ]
                    : []),
                ]}
              />
            </div>
          )}

          {/* この作品を見た人はこちらも見ています */}
          <div id="also-viewed" className="mt-8 scroll-mt-20">
            <Suspense fallback={<div className="theme-content h-48 animate-pulse rounded-lg" />}>
              <AlsoViewedWrapper productId={String(product.id)} locale={locale} />
            </Suspense>
          </div>
        </div>
      </div>

      {/* アフィリエイトリンク全クリックトラッキング */}
      <AffiliateClickTracker />

      {/* View tracking */}
      <ViewTracker
        productId={productId}
        productData={{
          id: String(product.id),
          title: product.title,
          imageUrl: product.imageUrl ?? null,
          aspName: product.provider || '',
        }}
      />

      {/* Mobile Sticky CTA - FANZA以外の商品のみ */}
      {product.affiliateUrl && product.provider !== 'fanza' && (
        <StickyCta
          affiliateUrl={product.affiliateUrl}
          providerLabel={product.providerLabel || ''}
          price={product.regularPrice || product.price}
          salePrice={product.salePrice}
          discount={product.discount}
          currency="JPY"
          saleEndAt={product.saleEndAt}
        />
      )}
    </>
  );
}
