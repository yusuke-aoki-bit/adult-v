import { notFound } from 'next/navigation';
import nextDynamic from 'next/dynamic';
import { JsonLD } from '@/components/JsonLD';
import ProductImageGallery from '@/components/ProductImageGallery';
import Breadcrumb, { type BreadcrumbItem } from '@/components/Breadcrumb';

// LCP最適化: ProductVideoPlayerを遅延読み込み（ファーストビュー外なので初期バンドルから除外）
const ProductVideoPlayer = nextDynamic(() => import('@/components/ProductVideoPlayer'), {
  loading: () => <div className="h-48 bg-gray-100 rounded-lg animate-pulse flex items-center justify-center text-gray-400">動画を読み込み中...</div>,
});
// LCP最適化: RelatedProductsを遅延読み込み（ファーストビュー外のコンポーネント）
const RelatedProducts = nextDynamic(() => import('@/components/RelatedProducts'), {
  loading: () => <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />,
});
import ProductDetailInfo from '@/components/ProductDetailInfo';
import '@/components/ProductActions';
import {
  ViewTracker,
  SocialShareButtons,
  productDetailTranslations,
} from '@adult-v/shared/components';
// AffiliateButton is available but currently unused - keeping import for future use
// import AffiliateButton from '@/components/AffiliateButton';
import FavoriteButton from '@/components/FavoriteButton';
import StickyCta from '@/components/StickyCta';
import { getProductById, searchProductByProductId, getProductSources } from '@/lib/db/queries';
import { isSubscriptionSite } from '@/lib/image-utils';
import { getRelatedProducts, getPerformerOtherProducts, getProductMaker, getSameMakerProducts, getProductGenreTags, getProductSeries, getSameSeriesProducts } from '@/lib/db/recommendations';
import { generateBaseMetadata, generateProductSchema, generateBreadcrumbSchema, generateOptimizedDescription, generateVideoObjectSchema, generateFAQSchema, getProductPageFAQs, generateReviewSchema } from '@/lib/seo';
import { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { localizedHref } from '@adult-v/shared/i18n';

export const dynamic = 'force-dynamic';

// Dynamic imports for heavy components to reduce initial bundle size
const SceneTimeline = nextDynamic(() => import('@/components/SceneTimeline'), {
  loading: () => <div className="h-32 bg-gray-100 rounded-lg animate-pulse" />,
});
const EnhancedAiReview = nextDynamic(() => import('@/components/EnhancedAiReview'), {
  loading: () => <div className="h-48 bg-gray-100 rounded-lg animate-pulse" />,
});
const ProductPriceSection = nextDynamic(() => import('@/components/ProductPriceSection'), {
  loading: () => <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />,
});

interface PageProps {
  params: Promise<{ id: string; locale: string }>;
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

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';

    // SEO最適化されたメタディスクリプション生成（セール/評価情報を含む）
    const productId = product.normalizedProductId || product.id;
    const optimizedDescription = generateOptimizedDescription(
      product.title,
      product.actressName,
      product.tags,
      product.releaseDate,
      productId,
      {
        salePrice: product.salePrice,
        regularPrice: product.regularPrice,
        discount: product.discount,
        rating: product.rating,
        reviewCount: product.reviewCount,
      },
    );

    // SEO: Titleに品番を含める（Google検索で品番検索時にヒットさせる）
    const seoTitle = productId ? `${productId} ${product.title}` : product.title;

    // canonical URLは現在のロケールに応じて設定（日本語はパラメータなし）
    const productPath = `/products/${product.id}`;
    const canonicalUrl = locale === 'ja' ? `${baseUrl}${productPath}` : `${baseUrl}${productPath}?hl=${locale}`;

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
  const tNav = await getTranslations('nav');
  const tCommon = await getTranslations('common');
  const tRelated = await getTranslations('relatedProducts');
  const t = productDetailTranslations[locale as keyof typeof productDetailTranslations] || productDetailTranslations.ja;

  // Try to get product by normalized ID first, then by database ID
  let product = await searchProductByProductId(id, locale);
  // foundByProductId is useful for future analytics/redirect logic
  const _foundByProductId = !!product;
  if (!product && !isNaN(parseInt(id))) {
    product = await getProductById(id, locale);
  }
  if (!product) notFound();

  // 品番でアクセスした場合でもリダイレクトしない（SEO: Google検索で品番URLがインデックスされる）
  // canonical URLで正規URLを指定（重複コンテンツ対策）
  // これにより /products/SSIS-865 でもページが表示され、Googleにインデックスされる

  const basePath = localizedHref(`/products/${product.id}`, locale);

  // Structured data（評価情報を含む - リッチリザルト表示でCTR向上）
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
    { name: product.title, url: localizedHref(`/products/${product.id}`, locale) },
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

  // 複数女優の場合、メイン女優のみ表示（パンくずが長くなりすぎないように）
  if (product.performers && product.performers.length > 0) {
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
  const displayTitle = product.normalizedProductId
    ? `${product.normalizedProductId}`
    : product.title.length > 30 ? product.title.substring(0, 30) + '...' : product.title;
  breadcrumbItems.push({ label: displayTitle });

  // E-E-A-T強化: 関連データを並列取得（パフォーマンス最適化）
  const productId = typeof product.id === 'string' ? parseInt(product.id) : product.id;
  const primaryPerformerId = product.performers?.[0]?.id || product.actressId;
  const primaryPerformerName = product.performers?.[0]?.name || product.actressName;

  // Phase 1: 基本データの並列取得（FANZAの商品のみ）
  const [
    relatedProducts,
    maker,
    series,
    genreTags,
    sources,
  ] = await Promise.all([
    getRelatedProducts(product.id, 12, 'fanza'),
    getProductMaker(productId),
    getProductSeries(productId),
    getProductGenreTags(productId),
    getProductSources(productId),
  ]);

  // Phase 2: Phase 1の結果に依存するデータの並列取得
  const [
    performerOtherProducts,
    sameMakerProducts,
    sameSeriesProducts,
  ] = await Promise.all([
    primaryPerformerId
      ? getPerformerOtherProducts(Number(primaryPerformerId), String(product.id), 6, 'fanza')
      : Promise.resolve([]),
    maker
      ? getSameMakerProducts(maker.id, productId, 6, 'fanza')
      : Promise.resolve([]),
    series
      ? getSameSeriesProducts(series.id, productId, 6, 'fanza')
      : Promise.resolve([]),
  ]);

  // 注意: apps/fanzaではFANZA ASP規約に準拠し、他ASPの画像は使用しない
  // crossAspSampleImagesは使用しない（FANZA以外のASPへの遷移・情報表示禁止）

  return (
    <>
      <JsonLD data={productSchema} />
      <JsonLD data={breadcrumbSchema} />
      {videoSchema && <JsonLD data={videoSchema} />}
      <JsonLD data={faqSchema} />
      {reviewSchema && <JsonLD data={reviewSchema} />}

      <div className="theme-body min-h-screen">
        <div className="container mx-auto px-4 py-8">
          {/* パンくずリスト */}
          <Breadcrumb items={breadcrumbItems} className="mb-6" />

          {/* サンプル動画セクション */}
          {product.sampleVideos && product.sampleVideos.length > 0 && (
            <details className="theme-content rounded-lg shadow-sm border theme-border mb-6 group" open>
              <summary className="p-4 cursor-pointer list-none flex items-center gap-2 hover:bg-gray-100 rounded-lg transition-colors">
                <svg className="w-5 h-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-lg font-semibold theme-text flex-1">サンプル動画 ({product.sampleVideos.length}本)</span>
                <svg className="w-5 h-5 text-gray-500 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

          <div className="theme-content rounded-lg shadow-sm border theme-border overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6">
              {/* Product Image Gallery */}
              <ProductImageGallery
                mainImage={product.imageUrl ?? null}
                sampleImages={product.sampleImages}
                productTitle={product.title}
              />

              {/* Product Info */}
              <div className="space-y-6">
                <div>
                  <div className="flex items-start gap-3 mb-2">
                    {/* SEO強化: H1に品番を含める（Google検索で品番検索時にヒット率向上） */}
                    <h1 className="text-3xl font-bold theme-text flex-1">
                      {product.normalizedProductId && (
                        <span className="text-rose-600">{product.normalizedProductId}</span>
                      )}
                      {product.normalizedProductId && ' '}
                      {product.title}
                    </h1>
                    <FavoriteButton
                      type="product"
                      id={productId}
                      title={product.title}
                      thumbnail={product.imageUrl}
                      size="lg"
                    />
                  </div>
                  <p className="theme-text-secondary">{product.providerLabel}</p>
                  {/* SEO強化: 品番を目立つ形で表示 */}
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="inline-flex items-center px-3 py-1 bg-rose-100 border border-rose-300 rounded-md text-rose-700 text-sm font-mono">
                      {product.normalizedProductId || product.id}
                    </span>
                    {sources.length > 0 && sources[0].originalProductId && sources[0].originalProductId !== product.normalizedProductId && (
                      <span className="inline-flex items-center px-2 py-1 bg-gray-100 rounded-md text-gray-600 text-xs font-mono">
                        {sources[0].originalProductId}
                      </span>
                    )}
                  </div>
                  {/* レビュー統計サマリー */}
                  {product.rating && product.rating > 0 && (
                    <div className="flex items-center gap-3 mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-center gap-1">
                        <svg className="w-6 h-6 text-yellow-500 fill-current" viewBox="0 0 24 24">
                          <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                        </svg>
                        <span className="text-2xl font-bold text-yellow-600">{product.rating.toFixed(1)}</span>
                      </div>
                      {product.reviewCount && product.reviewCount > 0 && (
                        <div className="flex flex-col">
                          <span className="text-sm text-gray-600">{product.reviewCount.toLocaleString()}件のレビュー</span>
                          <div className="flex gap-1 mt-1">
                            {[5, 4, 3, 2, 1].map((star) => (
                              <div key={star} className={`w-2 h-2 rounded-full ${(product.rating ?? 0) >= star ? 'bg-yellow-400' : 'bg-gray-300'}`} />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {/* SNSシェアボタン */}
                  <div className="mt-3">
                    <SocialShareButtons
                      title={`${product.normalizedProductId || product.id} ${product.title}`}
                      productId={String(product.id)}
                      compact
                    />
                  </div>
                </div>

                {product.performers && product.performers.length > 0 ? (
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <h2 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      {product.performers.length === 1 ? tCommon('actress') : t.performers}
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      {product.performers.map((performer) => (
                        <Link
                          key={performer.id}
                          href={localizedHref(`/actress/${performer.id}`, locale)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-full text-sm font-medium transition-colors"
                        >
                          <span>{performer.name}</span>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : product.actressName ? (
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <h2 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      {tCommon('actress')}
                    </h2>
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
                      <p className="theme-text">{product.actressName}</p>
                    )}
                  </div>
                ) : null}

                {product.description && (
                  <div>
                    <h2 className="text-sm font-semibold theme-text mb-2">{t.description}</h2>
                    <p className="theme-text whitespace-pre-wrap">{product.description}</p>
                  </div>
                )}

                {product.price && (
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-sm font-semibold text-gray-600">{t.price}</h2>
                      {product.salePrice && product.discount && (
                        <span className="inline-flex items-center px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded animate-pulse">
                          {product.discount}% OFF
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-3">
                      {product.salePrice ? (
                        <>
                          <p className="text-3xl font-bold text-red-500">
                            ¥{product.salePrice.toLocaleString()}
                          </p>
                          <p className="text-lg text-gray-400 line-through">
                            ¥{product.price.toLocaleString()}
                          </p>
                        </>
                      ) : (
                        <p className="text-3xl font-bold text-gray-900">
                          {product.provider && isSubscriptionSite(product.provider) && <span className="text-base text-gray-500 mr-1">{t.monthly}</span>}
                          ¥{product.price.toLocaleString()}
                        </p>
                      )}
                    </div>
                    {/* ファーストビューCTA - 目立つ購入ボタン */}
                    {product.affiliateUrl && (
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
                  </div>
                )}

                {product.releaseDate && (
                  <div>
                    <h2 className="text-sm font-semibold theme-text mb-2">{t.releaseDate}</h2>
                    <p className="theme-text">{product.releaseDate}</p>
                  </div>
                )}

                {genreTags.length > 0 && (
                  <div>
                    <h2 className="text-sm font-semibold theme-text mb-2">{t.tags}</h2>
                    <div className="flex flex-wrap gap-2">
                      {genreTags.map((tag) => (
                        <Link
                          key={tag.id}
                          href={localizedHref(`/products?tags=${tag.id}`, locale)}
                          className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full text-sm border border-gray-200 transition-colors"
                        >
                          {tag.name}
                        </Link>
                      ))}
                    </div>
                  </div>
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
                updatedAt={new Date()}
                performerCount={product.performers?.length || 0}
                tagCount={product.tags?.length || 0}
              />
            </div>
          )}

          {/* 価格追跡・セールアラートセクション */}
          {product.price && (
            <ProductPriceSection
              productId={productId}
              normalizedProductId={product.normalizedProductId || productId}
              title={product.title}
              thumbnailUrl={product.imageUrl ?? undefined}
              currentPrice={product.price}
              salePrice={product.salePrice ?? undefined}
              locale={locale}
            />
          )}

          {/* AI分析レビューセクション */}
          {product.aiReview && (
            <div className="mt-8">
              <EnhancedAiReview
                aiReview={product.aiReview}
                rating={product.rating}
                ratingCount={product.reviewCount}
                locale={locale}
              />
            </div>
          )}

          {/* シーン情報セクション（ユーザー参加型） */}
          <div className="mt-8">
            <SceneTimeline
              productId={productId}
              totalDuration={product.duration || undefined}
              locale={locale}
            />
          </div>

          {/* この出演者の他作品セクション */}
          {performerOtherProducts.length > 0 && primaryPerformerId && primaryPerformerName && (
            <div className="mt-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold theme-text flex items-center gap-2">
                  <svg className="w-5 h-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    className="group theme-content rounded-lg overflow-hidden hover:ring-2 hover:ring-rose-500/50 transition-all border theme-border shrink-0 w-[120px] sm:w-[140px] snap-start"
                  >
                    <div className="relative bg-gray-100" style={{ aspectRatio: '2/3' }}>
                      {p.imageUrl ? (
                        <img
                          src={p.imageUrl}
                          alt={p.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <span className="text-gray-400 text-xs">NO IMAGE</span>
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="text-xs theme-text line-clamp-2 group-hover:text-rose-600 transition-colors">
                        {p.title}
                      </p>
                    </div>
                  </Link>
                ))}
                {/* もっと見るカード */}
                <Link
                  href={localizedHref(`/actress/${primaryPerformerId}`, locale)}
                  className="group bg-linear-to-br from-rose-600/10 to-rose-800/10 rounded-lg overflow-hidden hover:from-rose-600/20 hover:to-rose-800/20 transition-all flex flex-col items-center justify-center border border-rose-500/30 hover:border-rose-500/50 shrink-0 w-[120px] sm:w-[140px] snap-start"
                  style={{ aspectRatio: '2/3' }}
                >
                  <svg className="w-8 h-8 text-rose-500 mb-2 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span className="text-sm font-medium text-rose-500">{tRelated('viewMore')}</span>
                </Link>
              </div>
            </div>
          )}

          {/* 同じシリーズの作品セクション */}
          {sameSeriesProducts.length > 0 && series && (
            <div className="mt-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold theme-text flex items-center gap-2">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    className="group theme-content rounded-lg overflow-hidden hover:ring-2 hover:ring-purple-500/50 transition-all border theme-border shrink-0 w-[120px] sm:w-[140px] snap-start"
                  >
                    <div className="relative bg-gray-100" style={{ aspectRatio: '2/3' }}>
                      {p.imageUrl ? (
                        <img
                          src={p.imageUrl}
                          alt={p.title || ''}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <span className="text-gray-400 text-xs">NO IMAGE</span>
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="text-xs theme-text line-clamp-2 group-hover:text-purple-600 transition-colors">
                        {p.title}
                      </p>
                    </div>
                  </Link>
                ))}
                {/* もっと見るカード */}
                <Link
                  href={localizedHref(`/series/${series.id}`, locale)}
                  className="group bg-linear-to-br from-purple-600/10 to-purple-800/10 rounded-lg overflow-hidden hover:from-purple-600/20 hover:to-purple-800/20 transition-all flex flex-col items-center justify-center border border-purple-500/30 hover:border-purple-500/50 shrink-0 w-[120px] sm:w-[140px] snap-start"
                  style={{ aspectRatio: '2/3' }}
                >
                  <svg className="w-8 h-8 text-purple-500 mb-2 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span className="text-sm font-medium text-purple-500">{tRelated('viewMore')}</span>
                </Link>
              </div>
            </div>
          )}

          {/* 同じメーカー/レーベルの作品セクション */}
          {sameMakerProducts.length > 0 && maker && (
            <div className="mt-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold theme-text flex items-center gap-2">
                  <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    className="group theme-content rounded-lg overflow-hidden hover:ring-2 hover:ring-amber-500/50 transition-all border theme-border shrink-0 w-[120px] sm:w-[140px] snap-start"
                  >
                    <div className="relative bg-gray-100" style={{ aspectRatio: '2/3' }}>
                      {p.imageUrl ? (
                        <img
                          src={p.imageUrl}
                          alt={p.title || ''}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <span className="text-gray-400 text-xs">NO IMAGE</span>
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="text-xs theme-text line-clamp-2 group-hover:text-amber-600 transition-colors">
                        {p.title}
                      </p>
                    </div>
                  </Link>
                ))}
                {/* もっと見るカード */}
                <Link
                  href={localizedHref(`/makers/${maker.id}`, locale)}
                  className="group bg-linear-to-br from-amber-600/10 to-amber-800/10 rounded-lg overflow-hidden hover:from-amber-600/20 hover:to-amber-800/20 transition-all flex flex-col items-center justify-center border border-amber-500/30 hover:border-amber-500/50 shrink-0 w-[120px] sm:w-[140px] snap-start"
                  style={{ aspectRatio: '2/3' }}
                >
                  <svg className="w-8 h-8 text-amber-500 mb-2 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span className="text-sm font-medium text-amber-500">{tRelated('viewMore')}</span>
                </Link>
              </div>
            </div>
          )}

          {/* 関連作品セクション */}
          {relatedProducts.length > 0 && (
            <RelatedProducts products={relatedProducts} title={t.relatedProducts} />
          )}
        </div>
      </div>

      {/* View tracking */}
      <ViewTracker
        productId={productId}
        productData={{
          id: product.id,
          title: product.title,
          imageUrl: product.imageUrl ?? null,
          aspName: product.provider || '',
        }}
      />

      {/* Mobile Sticky CTA */}
      {product.affiliateUrl && (
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
