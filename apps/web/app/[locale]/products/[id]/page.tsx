import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import nextDynamic from 'next/dynamic';
import { JsonLD } from '@/components/JsonLD';
import ProductImageGallery from '@/components/ProductImageGallery';
import Breadcrumb, { type BreadcrumbItem } from '@/components/Breadcrumb';

// LCP最適化: ProductVideoPlayerを遅延読み込み（ファーストビュー外なので初期バンドルから除外）
const ProductVideoPlayer = nextDynamic(() => import('@/components/ProductVideoPlayer'), {
  loading: () => <div className="h-48 bg-gray-700 rounded-lg animate-pulse flex items-center justify-center text-gray-500">動画を読み込み中...</div>,
});
import ProductDetailInfo from '@/components/ProductDetailInfo';
import ProductActions from '@/components/ProductActions';
import {
  ViewTracker,
  CostPerformanceCard,
  PriceComparisonServer,
  FanzaCrossLink,
  SocialShareButtons,
  productDetailTranslations,
  CopyButton,
  SectionVisibility,
} from '@adult-v/shared/components';
// AffiliateButton is available but currently unused - keeping import for future use
// import AffiliateButton from '@/components/AffiliateButton';
import StickyCta from '@/components/StickyCta';
import AiProductDescriptionWrapper from '@/components/AiProductDescriptionWrapper';
import AlsoViewedWrapper from '@/components/AlsoViewedWrapper';
import UserContributionsWrapper from '@/components/UserContributionsWrapper';
import SimilarProductMapWrapper from '@/components/SimilarProductMapWrapper';
import ProductSectionNav from '@/components/ProductSectionNav';
import { getProductById, searchProductByProductId, getProductSources, getActressAvgPricePerMin, getSampleImagesByMakerCode, getProductMakerCode, getAllProductSources } from '@/lib/db/queries';
import { formatProductCodeForDisplay } from '@adult-v/shared';
import { isSubscriptionSite } from '@/lib/image-utils';
import { getPerformerOtherProducts, getProductMaker, getSameMakerProducts, getProductGenreTags, getProductSeries, getSameSeriesProducts } from '@/lib/db/recommendations';
import { generateBaseMetadata, generateProductSchema, generateBreadcrumbSchema, generateOptimizedDescription, generateVideoObjectSchema, generateFAQSchema, getProductPageFAQs, generateReviewSchema, generateHowToSchema, generateAggregateOfferSchema } from '@/lib/seo';
import { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { localizedHref } from '@adult-v/shared/i18n';

// Force dynamic rendering to avoid DYNAMIC_SERVER_USAGE errors with getTranslations
// ISR with revalidate is not compatible with dynamic server functions
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

// Dynamic imports for heavy components (494 + 469 lines) to reduce initial bundle size
const SceneTimeline = nextDynamic(() => import('@/components/SceneTimeline'), {
  loading: () => <div className="h-32 bg-gray-800 rounded-lg animate-pulse" />,
});
const EnhancedAiReview = nextDynamic(() => import('@/components/EnhancedAiReview'), {
  loading: () => <div className="h-48 bg-gray-800 rounded-lg animate-pulse" />,
});

interface PageProps {
  params: Promise<{ id: string; locale: string }>;
}

/**
 * ビルド時に人気商品をプリレンダリング
 * 最新の1000件の商品IDを生成（日本語版のみ）
 */
export async function generateStaticParams(): Promise<Array<{ id: string; locale: string }>> {
  try {
    const { getRecentProducts } = await import('@/lib/db/queries');
    const recentProducts = await getRecentProducts({ limit: 1000 });
    return recentProducts.map((product) => ({
      id: product.id.toString(),
      locale: 'ja',
    }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const { id, locale } = await params;
    // Try to get product by normalized ID first, then by database ID
    let product = await searchProductByProductId(id, locale);
    if (!product && !isNaN(parseInt(id))) {
      product = await getProductById(id, locale);
    }
    if (!product) return {};

    const baseUrl = process.env['NEXT_PUBLIC_SITE_URL'] || 'https://example.com';

    // SEO最適化されたメタディスクリプション生成（セール・レーティング情報含む）
    const productId = product.normalizedProductId || product.id;
    const optimizedDescription = generateOptimizedDescription(
      product.title,
      product.actressName,
      product.tags,
      product.releaseDate,
      productId,
      {
        ...(product.salePrice != null && { salePrice: product.salePrice }),
        ...(product.regularPrice != null && { regularPrice: product.regularPrice }),
        ...(product.discount != null && { discount: product.discount }),
        ...(product.rating != null && { rating: product.rating }),
        ...(product.reviewCount != null && { reviewCount: product.reviewCount }),
      },
    );

    // SEO: Titleに品番を含める（Google検索で品番検索時にヒットさせる）
    const seoTitle = productId ? `${productId} ${product.title}` : product.title;

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
          'ja': `${baseUrl}${productPath}`,
          'en': `${baseUrl}${productPath}?hl=en`,
          'zh': `${baseUrl}${productPath}?hl=zh`,
          'zh-TW': `${baseUrl}${productPath}?hl=zh-TW`,
          'ko': `${baseUrl}${productPath}?hl=ko`,
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
  const [tNav, tCommon, tRelated, product] = await Promise.all([
    getTranslations('nav'),
    getTranslations('common'),
    getTranslations('relatedProducts'),
    searchProductByProductId(id, locale).then(async (p) => {
      if (p) return p;
      if (!isNaN(parseInt(id))) {
        return getProductById(id, locale);
      }
      return null;
    }),
  ]);
  const t = productDetailTranslations[locale as keyof typeof productDetailTranslations] || productDetailTranslations.ja;
  if (!product) notFound();

  // 品番でアクセスした場合でもリダイレクトしない（SEO: Google検索で品番URLがインデックスされる）
  // canonical URLで正規URLを指定（重複コンテンツ対策）
  // これにより /products/SSIS-865 でもページが表示され、Googleにインデックスされる

  const basePath = localizedHref(`/products/${product.id}`, locale);

  // Structured data（レーティング情報含む）
  const productSchema = generateProductSchema(
    product.title,
    product.description || '',
    product.imageUrl,
    basePath,
    product.regularPrice || product.price,
    product.providerLabel,
    product.rating && product.reviewCount ? {
      ratingValue: product.rating,
      reviewCount: product.reviewCount,
    } : undefined,
    product.salePrice,
    product.currency || 'JPY',
    product.normalizedProductId || undefined, // SKU（品番）
  );

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: tNav('home'), url: localizedHref('/', locale) },
    { name: product.title, url: basePath },
  ]);

  // VideoObject Schema（サンプル動画がある場合）
  const videoSchema = product.sampleVideos && product.sampleVideos.length > 0
    ? generateVideoObjectSchema(
        product.title,
        product.description || `${product.title}のサンプル動画`,
        product.imageUrl,
        product.sampleVideos[0].url,
        product.duration,
        product.releaseDate,
      )
    : null;

  // FAQ Schema（商品ページ用）
  const productFaqs = getProductPageFAQs(locale, {
    productId: product.normalizedProductId || undefined,
    title: product.title,
    duration: product.duration,
    releaseDate: product.releaseDate,
    provider: product.providerLabel,
    actressName: product.actressName || product.performers?.[0]?.name,
    isHD: true, // 基本的にHD対応と仮定
  });
  const faqSchema = generateFAQSchema(productFaqs);

  // Review Schema（AIレビューがある場合）
  const reviewSchema = product.aiReview
    ? generateReviewSchema(
        product.aiReview,
        product.title,
        basePath,
        {
          ratingValue: product.rating,
          productImage: product.imageUrl ?? undefined,
          productId: product.normalizedProductId || undefined,
          datePublished: product.releaseDate || undefined,
        }
      )
    : null;

  // HowTo Schema（視聴方法ガイド - リッチスニペット表示）
  const howToSchema = product.providerLabel && product.affiliateUrl
    ? generateHowToSchema(
        product.title,
        product.providerLabel,
        product.affiliateUrl,
        locale,
      )
    : null;

  // パンくずリスト用のアイテム作成（SEO・ナビゲーション強化）
  const breadcrumbItems: BreadcrumbItem[] = [
    { label: tNav('home'), href: localizedHref('/', locale) },
  ];

  // プロバイダー（配信元）を追加
  if (product.providerLabel) {
    breadcrumbItems.push({
      label: product.providerLabel,
      href: localizedHref(`/products?provider=${product.provider}`, locale),
    });
  }

  // 複数女優の場合、それぞれのパンくずリストを追加
  if (product.performers && product.performers.length > 0) {
    // メイン女優のみ表示（パンくずが長くなりすぎないように）
    const mainPerformer = product.performers[0];
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
    : product.title.length > 30 ? product.title.substring(0, 30) + '...' : product.title;
  breadcrumbItems.push({ label: displayTitle });

  // E-E-A-T強化: 関連データを並列取得（パフォーマンス最適化）
  const productId = typeof product.id === 'string' ? parseInt(product.id) : product.id;
  const primaryPerformerId = product.performers?.[0]?.id || product.actressId;
  const primaryPerformerName = product.performers?.[0]?.name || product.actressName;
  const actressId = product.actressId || product.performers?.[0]?.id;

  // Phase 1: 基本データの並列取得
  const [
    maker,
    series,
    genreTags,
    sources,
    makerProductCode,
  ] = await Promise.all([
    getProductMaker(productId),
    getProductSeries(productId),
    getProductGenreTags(productId),
    getProductSources(productId),
    getProductMakerCode(productId),
  ]);

  // Phase 2: Phase 1の結果に依存するデータの並列取得
  const [
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
    maker
      ? getSameMakerProducts(maker.id, productId, 6)
      : Promise.resolve([]),
    series
      ? getSameSeriesProducts(series.id, productId, 6)
      : Promise.resolve([]),
    getAllProductSources(productId, product.title, makerProductCode),
    makerProductCode
      ? getSampleImagesByMakerCode(makerProductCode)
      : Promise.resolve([]),
    actressId
      ? getActressAvgPricePerMin(String(actressId))
      : Promise.resolve(null),
  ]);

  // AggregateOffer Schema（複数ASP価格比較 - リッチスニペット表示）
  const aggregateOfferSchema = sourcesWithSales.length > 1
    ? generateAggregateOfferSchema(
        sourcesWithSales.map(source => ({
          providerName: source.aspName,
          price: source.regularPrice ?? 0,
          salePrice: source.salePrice ?? undefined,
          url: source.affiliateUrl || '',
          availability: 'InStock' as const,
        })),
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
          hasCostPerformance={!!(product.price && product.duration && product.duration > 0)}
          hasAiReview={!!product.aiReview}
          hasPerformerProducts={performerOtherProducts.length > 0 && !!primaryPerformerId}
          hasSeriesProducts={sameSeriesProducts.length > 0 && !!series}
          hasMakerProducts={sameMakerProducts.length > 0 && !!maker}
          hasAlsoViewed={true}
        />

        <div className="container mx-auto px-4 py-8">
          {/* パンくずリスト */}
          <Breadcrumb items={breadcrumbItems} className="mb-6" />

          {/* サンプル動画セクション */}
          {product.sampleVideos && product.sampleVideos.length > 0 && (
            <details id="sample-video" className="bg-gray-800 rounded-lg shadow-md mb-6 group scroll-mt-20">
              <summary className="p-4 cursor-pointer list-none flex items-center gap-2 hover:bg-gray-750 rounded-lg transition-colors">
                <svg className="w-5 h-5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-lg font-semibold text-white flex-1">サンプル動画 ({product.sampleVideos.length}本)</span>
                <svg className="w-5 h-5 text-gray-400 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="p-6 pt-2">
                <ProductVideoPlayer
                  sampleVideos={product.sampleVideos}
                  productTitle={product.title}
                />
              </div>
            </details>
          )}

          <div id="product-info" className="bg-gray-800 rounded-lg shadow-md overflow-hidden scroll-mt-20">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6">
              {/* Product Image Gallery */}
              <ProductImageGallery
                mainImage={product.imageUrl ?? null}
                sampleImages={product.sampleImages}
                productTitle={product.title}
                crossAspImages={crossAspSampleImages}
              />

              {/* Product Info */}
              <div className="space-y-6">
                <div>
                  <div className="flex items-start gap-3 mb-2">
                    {/* SEO強化: H1に品番を含める（Google検索で品番検索時にヒット率向上） */}
                    {/* 正規化された品番を使用 */}
                    <h1 className="text-3xl font-bold text-white flex-1">
                      {displayProductCode && (
                        <span className="text-rose-400">{displayProductCode}</span>
                      )}
                      {displayProductCode && ' '}
                      {product.title}
                    </h1>
                    <ProductActions
                      productId={productId}
                      title={product.title}
                      imageUrl={product.imageUrl ?? null}
                      provider={product.provider || ''}
                      performerName={product.actressName || product.performers?.[0]?.name}
                      performerId={product.actressId || product.performers?.[0]?.id}
                      tags={product.tags}
                      duration={product.duration}
                      locale={locale}
                    />
                  </div>
                  <p className="text-gray-300">{product.providerLabel}</p>
                  {/* SEO強化: 品番を目立つ形で表示 + コピーボタン */}
                  {/* 正規化された品番を使用 */}
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <div className="inline-flex items-center gap-1">
                      <span className="inline-flex items-center px-3 py-1 bg-rose-900/50 border border-rose-700 rounded-md text-rose-200 text-sm font-mono">
                        {displayProductCode || product.id}
                      </span>
                      <CopyButton text={displayProductCode || String(product.id)} label="品番" iconOnly size="xs" />
                    </div>
                    <div className="inline-flex items-center gap-1">
                      <CopyButton text={product.title} label="タイトル" size="xs" />
                    </div>
                    {sources.length > 0 && sources[0].originalProductId &&
                     sources[0].originalProductId !== displayProductCode && (
                      <span className="inline-flex items-center px-2 py-1 bg-gray-700 rounded-md text-gray-300 text-xs font-mono">
                        {sources[0].originalProductId}
                      </span>
                    )}
                  </div>
                  {/* レビュー統計サマリー */}
                  {product.rating && product.rating > 0 && (
                    <div className="flex items-center gap-3 mt-3 p-3 bg-gray-700/50 rounded-lg">
                      <div className="flex items-center gap-1">
                        <svg className="w-6 h-6 text-yellow-400 fill-current" viewBox="0 0 24 24">
                          <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                        </svg>
                        <span className="text-2xl font-bold text-yellow-400">{product.rating.toFixed(1)}</span>
                      </div>
                      {product.reviewCount && product.reviewCount > 0 && (
                        <div className="flex flex-col">
                          <span className="text-sm text-gray-300">{product.reviewCount.toLocaleString()}件のレビュー</span>
                          <div className="flex gap-1 mt-1">
                            {[5, 4, 3, 2, 1].map((star) => (
                              <div key={star} className={`w-2 h-2 rounded-full ${(product.rating ?? 0) >= star ? 'bg-yellow-400' : 'bg-gray-600'}`} />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {/* SNSシェアボタン */}
                  <div className="mt-3">
                    <SocialShareButtons
                      title={`${displayProductCode || product.id} ${product.title}`}
                      productId={String(product.id)}
                      compact
                    />
                  </div>
                </div>

                {product.performers && product.performers.length > 0 ? (
                  <div className="bg-gray-700/50 rounded-lg p-4">
                    <h2 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      {product.performers.length === 1 ? tCommon('actress') : t.performers}
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      {/* 商品IDベースのシードでランダム化（一貫した順序を保持、ビルド時の動的値使用を回避） */}
                      {shuffleArray(product.performers, productId).map((performer) => (
                        <div key={performer.id} className="inline-flex items-center gap-1">
                          <Link
                            href={localizedHref(`/actress/${performer.id}`, locale)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-full text-sm font-medium transition-colors"
                          >
                            <span>{performer.name}</span>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </Link>
                          <CopyButton text={performer.name} iconOnly size="xs" />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : product.actressName ? (
                  <div className="bg-gray-700/50 rounded-lg p-4">
                    <h2 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      {tCommon('actress')}
                    </h2>
                    <div className="inline-flex items-center gap-1">
                      {product.actressId ? (
                        <Link
                          href={localizedHref(`/actress/${product.actressId}`, locale)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-full text-sm font-medium transition-colors"
                        >
                          <span>{product.actressName}</span>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    <h2 className="text-sm font-semibold text-white mb-2">{t.description}</h2>
                    <p className="text-white whitespace-pre-wrap">{product.description}</p>
                  </div>
                )}

                {/* AI生成の作品紹介 */}
                <AiProductDescriptionWrapper
                  productId={String(product.id)}
                  locale={locale}
                />

                {product.price && (
                  <div className="bg-gray-700/50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-sm font-semibold text-gray-400">{t.price}</h2>
                      {product.salePrice && product.discount && (
                        <span className="inline-flex items-center px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded animate-pulse">
                          {product.discount}% OFF
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-3">
                      {product.salePrice ? (
                        <>
                          <p className="text-3xl font-bold text-red-400">
                            ¥{product.salePrice.toLocaleString()}
                          </p>
                          <p className="text-lg text-gray-500 line-through">
                            ¥{product.price.toLocaleString()}
                          </p>
                        </>
                      ) : (
                        <p className="text-3xl font-bold text-white">
                          {product.provider && isSubscriptionSite(product.provider) && <span className="text-base text-gray-400 mr-1">{t.monthly}</span>}
                          ¥{product.price.toLocaleString()}
                        </p>
                      )}
                    </div>
                    {/* ファーストビューCTA - 目立つ購入ボタン */}
                    {product.affiliateUrl && product.provider !== 'fanza' && (
                      <a
                        href={product.affiliateUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full mt-4 py-3 bg-linear-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-bold text-lg rounded-lg shadow-lg shadow-rose-500/25 hover:shadow-rose-500/40 transition-all transform hover:scale-[1.02]"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        {product.providerLabel}で購入
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    )}
                    {/* 他のASPでも購入可能な場合のリンク */}
                    {sourcesWithSales.length > 1 && (
                      <div className="mt-3 pt-3 border-t border-gray-600">
                        <p className="text-xs text-gray-400 mb-2">
                          他{sourcesWithSales.length - 1}社でも購入可能
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {sourcesWithSales.slice(1, 4).map((source) => {
                            // 有効なURLかチェック（http/httpsで始まるもののみ）
                            const isValidUrl = source.affiliateUrl && source.affiliateUrl.startsWith('http');
                            return (
                              <a
                                key={source.aspName}
                                href={isValidUrl ? source.affiliateUrl : `/${locale}/products/${source.originalProductId || ''}`}
                                target={isValidUrl ? "_blank" : "_self"}
                                rel={isValidUrl ? "noopener noreferrer sponsored" : undefined}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-gray-600 hover:bg-gray-500 text-gray-200 text-xs rounded transition-colors"
                              >
                                <span>{source.aspName}</span>
                                <span className="text-gray-400">¥{(source.salePrice || source.regularPrice || 0).toLocaleString()}</span>
                              </a>
                            );
                          })}
                          {sourcesWithSales.length > 4 && (
                            <a
                              href="#price-comparison"
                              className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-700 hover:bg-emerald-600 text-white text-xs rounded transition-colors"
                            >
                              <span>+{sourcesWithSales.length - 4}社</span>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {product.releaseDate && (
                  <div>
                    <h2 className="text-sm font-semibold text-white mb-2">{t.releaseDate}</h2>
                    <p className="text-white">{product.releaseDate}</p>
                  </div>
                )}

                {genreTags.length > 0 && (
                  <div>
                    <h2 className="text-sm font-semibold text-white mb-2">{t.tags}</h2>
                    <div className="flex flex-wrap gap-2">
                      {genreTags.map((tag) => (
                        <Link
                          key={tag.id}
                          href={localizedHref(`/products?tags=${tag.id}`, locale)}
                          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-full text-sm transition-colors"
                        >
                          {tag.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* FANZAで見る（apps/fanza経由、直リンクは規約違反） */}
                {sources.find(s => s.aspName?.toUpperCase() === 'FANZA') && (
                  <FanzaCrossLink
                    productId={product.normalizedProductId || product.id}
                    locale={locale}
                    className="mt-4"
                  />
                )}
              </div>
            </div>
          </div>

          {/* E-E-A-T強化: 詳細情報セクション */}
          {sources.length > 0 && (
            <div className="mt-8">
              <ProductDetailInfo
                duration={product.duration || null}
                releaseDate={product.releaseDate || null}
                sources={sources}
                updatedAt={null}
                performerCount={product.performers?.length || 0}
                tagCount={product.tags?.length || 0}
              />
            </div>
          )}

          {/* 価格比較セクション - 複数ASPがある場合は価格比較を表示 */}
          {sourcesWithSales.length > 0 && (
            <SectionVisibility sectionId="price-comparison" pageId="product" locale={locale}>
              <div id="price-comparison" className="mt-8 scroll-mt-20">
                <PriceComparisonServer sources={sourcesWithSales} locale={locale} />
              </div>
            </SectionVisibility>
          )}

          {/* コスパ分析セクション */}
          {product.price && product.duration && product.duration > 0 && (
            <SectionVisibility sectionId="cost-performance" pageId="product" locale={locale}>
              <div id="cost-performance" className="mt-8 scroll-mt-20">
                <CostPerformanceCard
                  price={product.price}
                  salePrice={product.salePrice}
                  duration={product.duration}
                  actressAvgPricePerMin={actressAvgPricePerMin ?? undefined}
                  locale={locale}
                />
              </div>
            </SectionVisibility>
          )}

          {/* AI分析レビューセクション */}
          {product.aiReview && (
            <SectionVisibility sectionId="ai-review" pageId="product" locale={locale}>
              <div id="ai-review" className="mt-8 scroll-mt-20">
                <EnhancedAiReview
                  aiReview={product.aiReview}
                  rating={product.rating}
                  ratingCount={product.reviewCount}
                  locale={locale}
                />
              </div>
            </SectionVisibility>
          )}

          {/* シーン情報セクション（ユーザー参加型） */}
          <SectionVisibility sectionId="scene-timeline" pageId="product" locale={locale}>
            <div id="scene-timeline" className="mt-8 scroll-mt-20">
              <SceneTimeline
                productId={productId}
                totalDuration={product.duration || undefined}
                locale={locale}
              />
            </div>
          </SectionVisibility>

          {/* この出演者の他作品セクション */}
          {performerOtherProducts.length > 0 && primaryPerformerId && primaryPerformerName && (
            <SectionVisibility sectionId="performer-products" pageId="product" locale={locale}>
            <div id="performer-products" className="mt-8 scroll-mt-20">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  {tRelated('performerOtherWorks', { name: primaryPerformerName })}
                </h2>
                <Link
                  href={localizedHref(`/actress/${primaryPerformerId}`, locale)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors shadow-sm"
                >
                  {tRelated('viewAll')}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory">
                {performerOtherProducts.map((p) => (
                  <Link
                    key={p.id}
                    href={localizedHref(`/products/${p.id}`, locale)}
                    className="group bg-gray-800 rounded-lg overflow-hidden hover:ring-2 hover:ring-rose-500/50 transition-all shrink-0 w-[120px] sm:w-[140px] snap-start"
                  >
                    <div className="relative bg-gray-700" style={{ aspectRatio: '2/3' }}>
                      {p.imageUrl ? (
                        <img
                          src={p.imageUrl}
                          alt={p.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <span className="text-gray-500 text-xs">NO IMAGE</span>
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="text-xs text-gray-200 line-clamp-2 group-hover:text-rose-300 transition-colors">
                        {p.title}
                      </p>
                    </div>
                  </Link>
                ))}
                {/* もっと見るカード */}
                <Link
                  href={localizedHref(`/actress/${primaryPerformerId}`, locale)}
                  className="group bg-linear-to-br from-rose-600/20 to-rose-800/20 rounded-lg overflow-hidden hover:from-rose-600/30 hover:to-rose-800/30 transition-all flex flex-col items-center justify-center border border-rose-500/30 hover:border-rose-500/50 shrink-0 w-[120px] sm:w-[140px] snap-start"
                  style={{ aspectRatio: '2/3' }}
                >
                  <svg className="w-8 h-8 text-rose-400 mb-2 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span className="text-sm font-medium text-rose-400">{tRelated('viewMore')}</span>
                </Link>
              </div>
            </div>
            </SectionVisibility>
          )}

          {/* 同じシリーズの作品セクション */}
          {sameSeriesProducts.length > 0 && series && (
            <SectionVisibility sectionId="series-products" pageId="product" locale={locale}>
            <div id="series-products" className="mt-8 scroll-mt-20">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  {tRelated('seriesWorks', { name: series.name })}
                </h2>
                <Link
                  href={localizedHref(`/series/${series.id}`, locale)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors shadow-sm"
                >
                  {tRelated('viewAll')}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory">
                {sameSeriesProducts.map((p) => (
                  <Link
                    key={p.id}
                    href={localizedHref(`/products/${p.id}`, locale)}
                    className="group bg-gray-800 rounded-lg overflow-hidden hover:ring-2 hover:ring-purple-500/50 transition-all shrink-0 w-[120px] sm:w-[140px] snap-start"
                  >
                    <div className="relative bg-gray-700" style={{ aspectRatio: '2/3' }}>
                      {p.imageUrl ? (
                        <img
                          src={p.imageUrl}
                          alt={p.title || ''}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <span className="text-gray-500 text-xs">NO IMAGE</span>
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="text-xs text-gray-200 line-clamp-2 group-hover:text-purple-300 transition-colors">
                        {p.title}
                      </p>
                    </div>
                  </Link>
                ))}
                {/* もっと見るカード */}
                <Link
                  href={localizedHref(`/series/${series.id}`, locale)}
                  className="group bg-linear-to-br from-purple-600/20 to-purple-800/20 rounded-lg overflow-hidden hover:from-purple-600/30 hover:to-purple-800/30 transition-all flex flex-col items-center justify-center border border-purple-500/30 hover:border-purple-500/50 shrink-0 w-[120px] sm:w-[140px] snap-start"
                  style={{ aspectRatio: '2/3' }}
                >
                  <svg className="w-8 h-8 text-purple-400 mb-2 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span className="text-sm font-medium text-purple-400">{tRelated('viewMore')}</span>
                </Link>
              </div>
            </div>
            </SectionVisibility>
          )}

          {/* 同じメーカー/レーベルの作品セクション */}
          {sameMakerProducts.length > 0 && maker && (
            <SectionVisibility sectionId="maker-products" pageId="product" locale={locale}>
            <div id="maker-products" className="mt-8 scroll-mt-20">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  {tRelated('makerOtherWorks', { name: maker.name })}
                </h2>
                <Link
                  href={localizedHref(`/makers/${maker.id}`, locale)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-amber-600 hover:bg-amber-500 rounded-lg transition-colors shadow-sm"
                >
                  {tRelated('viewAll')}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory">
                {sameMakerProducts.map((p) => (
                  <Link
                    key={p.id}
                    href={localizedHref(`/products/${p.id}`, locale)}
                    className="group bg-gray-800 rounded-lg overflow-hidden hover:ring-2 hover:ring-amber-500/50 transition-all shrink-0 w-[120px] sm:w-[140px] snap-start"
                  >
                    <div className="relative bg-gray-700" style={{ aspectRatio: '2/3' }}>
                      {p.imageUrl ? (
                        <img
                          src={p.imageUrl}
                          alt={p.title || ''}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <span className="text-gray-500 text-xs">NO IMAGE</span>
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="text-xs text-gray-200 line-clamp-2 group-hover:text-amber-300 transition-colors">
                        {p.title}
                      </p>
                    </div>
                  </Link>
                ))}
                {/* もっと見るカード */}
                <Link
                  href={localizedHref(`/makers/${maker.id}`, locale)}
                  className="group bg-linear-to-br from-amber-600/20 to-amber-800/20 rounded-lg overflow-hidden hover:from-amber-600/30 hover:to-amber-800/30 transition-all flex flex-col items-center justify-center border border-amber-500/30 hover:border-amber-500/50 shrink-0 w-[120px] sm:w-[140px] snap-start"
                  style={{ aspectRatio: '2/3' }}
                >
                  <svg className="w-8 h-8 text-amber-400 mb-2 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span className="text-sm font-medium text-amber-400">{tRelated('viewMore')}</span>
                </Link>
              </div>
            </div>
            </SectionVisibility>
          )}

          {/* 類似作品ネットワーク */}
          <SectionVisibility sectionId="similar-network" pageId="product" locale={locale}>
            <div id="similar-network" className="mt-8 scroll-mt-20">
              <Suspense fallback={<div className="h-64 bg-gray-800 rounded-lg animate-pulse" />}>
                <SimilarProductMapWrapper productId={productId} locale={locale} />
              </Suspense>
            </div>
          </SectionVisibility>

          {/* この作品を見た人はこちらも見ています */}
          <SectionVisibility sectionId="also-viewed" pageId="product" locale={locale}>
            <div id="also-viewed" className="mt-8 scroll-mt-20">
              <Suspense fallback={<div className="h-48 bg-gray-800 rounded-lg animate-pulse" />}>
                <AlsoViewedWrapper productId={String(product.id)} locale={locale} />
              </Suspense>
            </div>
          </SectionVisibility>

          {/* ユーザー投稿セクション（レビュー、タグ提案、出演者提案） */}
          <SectionVisibility sectionId="user-contributions" pageId="product" locale={locale}>
            <div id="user-contributions" className="mt-8 scroll-mt-20">
              <Suspense fallback={<div className="h-32 bg-gray-800 rounded-lg animate-pulse" />}>
                <UserContributionsWrapper
                  productId={productId}
                  locale={locale}
                  existingTags={genreTags.map((t) => t.name)}
                  existingPerformers={product.performers?.map((p) => p.name) || (product.actressName ? [product.actressName] : [])}
                />
              </Suspense>
            </div>
          </SectionVisibility>
        </div>
      </div>

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
          currency={product.currency}
          saleEndAt={product.saleEndAt}
        />
      )}
    </>
  );
}
