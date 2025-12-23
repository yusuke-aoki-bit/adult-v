import { notFound } from 'next/navigation';
import nextDynamic from 'next/dynamic';
import { JsonLD } from '@/components/JsonLD';
import ProductImageGallery from '@/components/ProductImageGallery';
import ProductVideoPlayer from '@/components/ProductVideoPlayer';
import Breadcrumb, { type BreadcrumbItem } from '@/components/Breadcrumb';
import RelatedProducts from '@/components/RelatedProducts';
import ProductDetailInfo from '@/components/ProductDetailInfo';
import ProductActions from '@/components/ProductActions';
import {
  ViewTracker,
  CostPerformanceCard,
  PriceComparisonServer,
  FanzaCrossLink,
} from '@adult-v/shared/components';
import AffiliateButton from '@/components/AffiliateButton';
import StickyCta from '@/components/StickyCta';
import { getProductById, searchProductByProductId, getProductSources, getActressAvgPricePerMin, getProductSourcesWithSales } from '@/lib/db/queries';
import { isSubscriptionSite } from '@/lib/image-utils';
import { getRelatedProducts, getPerformerOtherProducts } from '@/lib/db/recommendations';
import { generateBaseMetadata, generateProductSchema, generateBreadcrumbSchema, generateOptimizedDescription, generateVideoObjectSchema } from '@/lib/seo';
import { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

// ISR: Revalidate every 10 minutes for product details
// Product data changes rarely, cache improves performance significantly
export const revalidate = 600;

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

    // SEO最適化されたメタディスクリプション生成（セール・レーティング情報含む）
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

    return {
      ...generateBaseMetadata(
        seoTitle,
        optimizedDescription,
        product.imageUrl,
        `/${locale}/products/${product.id}`,
      ),
      alternates: {
        canonical: `${baseUrl}/products/${product.id}`,
        languages: {
          'ja': `${baseUrl}/products/${product.id}`,
          'en': `${baseUrl}/products/${product.id}?hl=en`,
          'zh': `${baseUrl}/products/${product.id}?hl=zh`,
          'zh-TW': `${baseUrl}/products/${product.id}?hl=zh-TW`,
          'ko': `${baseUrl}/products/${product.id}?hl=ko`,
          'x-default': `${baseUrl}/products/${product.id}`,
        },
      },
    };
  } catch {
    return {};
  }
}

// Product detail translations
const productDetailTranslations = {
  ja: {
    description: '説明',
    price: '価格',
    monthly: '月額',
    releaseDate: '発売日',
    tags: 'タグ',
    relatedProducts: '関連作品',
    sampleVideos: 'サンプル動画',
    productId: '作品ID',
    makerId: 'メーカー品番',
    performers: '出演者',
  },
  en: {
    description: 'Description',
    price: 'Price',
    monthly: 'Monthly',
    releaseDate: 'Release Date',
    tags: 'Tags',
    relatedProducts: 'Related Products',
    sampleVideos: 'Sample Videos',
    productId: 'Product ID',
    makerId: 'Maker ID',
    performers: 'Performers',
  },
  zh: {
    description: '描述',
    price: '价格',
    monthly: '月费',
    releaseDate: '发售日期',
    tags: '标签',
    relatedProducts: '相关作品',
    sampleVideos: '示例视频',
    productId: '作品ID',
    makerId: '制造商编号',
    performers: '出演者',
  },
  ko: {
    description: '설명',
    price: '가격',
    monthly: '월정액',
    releaseDate: '발매일',
    tags: '태그',
    relatedProducts: '관련 작품',
    sampleVideos: '샘플 동영상',
    productId: '작품ID',
    makerId: '메이커 번호',
    performers: '출연자',
  },
} as const;

export default async function ProductDetailPage({ params }: PageProps) {
  const { id, locale } = await params;
  const tNav = await getTranslations('nav');
  const tCommon = await getTranslations('common');
  const t = productDetailTranslations[locale as keyof typeof productDetailTranslations] || productDetailTranslations.ja;

  // Try to get product by normalized ID first, then by database ID
  let product = await searchProductByProductId(id, locale);
  if (!product && !isNaN(parseInt(id))) {
    product = await getProductById(id, locale);
  }
  if (!product) notFound();

  const basePath = `/${locale}/products/${product.id}`;

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
    { name: tNav('home'), url: `/${locale}` },
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

  // パンくずリスト用のアイテム作成
  const breadcrumbItems: BreadcrumbItem[] = [
    { label: tNav('home'), href: `/${locale}` },
  ];

  // 複数女優の場合、それぞれのパンくずリストを追加
  if (product.performers && product.performers.length > 0) {
    product.performers.forEach((performer) => {
      breadcrumbItems.push({
        label: performer.name,
        href: `/${locale}/actress/${performer.id}`,
      });
    });
  } else if (product.actressName && product.actressId) {
    breadcrumbItems.push({
      label: product.actressName,
      href: `/${locale}/actress/${product.actressId}`,
    });
  }

  // 最後に商品タイトルを追加（リンクなし）
  breadcrumbItems.push({ label: product.title });

  // 関連作品を取得
  const relatedProducts = await getRelatedProducts(product.id, 12);

  // 出演者の他作品を取得（主演者のみ）
  const primaryPerformerId = product.performers?.[0]?.id || product.actressId;
  const primaryPerformerName = product.performers?.[0]?.name || product.actressName;
  const performerOtherProducts = primaryPerformerId
    ? await getPerformerOtherProducts(Number(primaryPerformerId), String(product.id), 6)
    : [];

  // E-E-A-T強化: 全ASPソース情報を取得
  const productId = typeof product.id === 'string' ? parseInt(product.id) : product.id;
  const sources = await getProductSources(productId);

  // 価格比較: セール情報付きソースを取得
  const sourcesWithSales = await getProductSourcesWithSales(productId);

  // コスパ分析: 女優の平均価格/分を取得
  const actressId = product.actressId || product.performers?.[0]?.id;
  const actressAvgPricePerMin = actressId
    ? await getActressAvgPricePerMin(String(actressId))
    : null;

  return (
    <>
      <JsonLD data={productSchema} />
      <JsonLD data={breadcrumbSchema} />
      {videoSchema && <JsonLD data={videoSchema} />}

      <div className="theme-body min-h-screen">
        <div className="container mx-auto px-4 py-8">
          {/* パンくずリスト */}
          <Breadcrumb items={breadcrumbItems} className="mb-6" />

          {/* サンプル動画セクション */}
          {product.sampleVideos && product.sampleVideos.length > 0 && (
            <details className="bg-gray-800 rounded-lg shadow-md mb-6 group">
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

          <div className="bg-gray-800 rounded-lg shadow-md overflow-hidden">
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
                    <h1 className="text-3xl font-bold text-white flex-1">{product.title}</h1>
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
                  {/* SEO強化: 品番を目立つ形で表示 */}
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="inline-flex items-center px-3 py-1 bg-rose-900/50 border border-rose-700 rounded-md text-rose-200 text-sm font-mono">
                      {product.normalizedProductId || product.id}
                    </span>
                    {sources.length > 0 && sources[0].originalProductId && sources[0].originalProductId !== product.normalizedProductId && (
                      <span className="inline-flex items-center px-2 py-1 bg-gray-700 rounded-md text-gray-300 text-xs font-mono">
                        {sources[0].originalProductId}
                      </span>
                    )}
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
                      {product.performers.map((performer) => (
                        <Link
                          key={performer.id}
                          href={`/${locale}/actress/${performer.id}`}
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
                  <div className="bg-gray-700/50 rounded-lg p-4">
                    <h2 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      {tCommon('actress')}
                    </h2>
                    {product.actressId ? (
                      <Link
                        href={`/${locale}/actress/${product.actressId}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-full text-sm font-medium transition-colors"
                      >
                        <span>{product.actressName}</span>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    ) : (
                      <p className="text-white">{product.actressName}</p>
                    )}
                  </div>
                ) : null}

                {product.description && (
                  <div>
                    <h2 className="text-sm font-semibold text-white mb-2">{t.description}</h2>
                    <p className="text-white whitespace-pre-wrap">{product.description}</p>
                  </div>
                )}

                {product.price && (
                  <div>
                    <h2 className="text-sm font-semibold text-white mb-2">{t.price}</h2>
                    <p className="text-2xl font-bold text-white">
                      {product.provider && isSubscriptionSite(product.provider) && <span className="text-base text-gray-400 mr-1">{t.monthly}</span>}
                      ¥{product.price.toLocaleString()}
                    </p>
                  </div>
                )}

                {product.releaseDate && (
                  <div>
                    <h2 className="text-sm font-semibold text-white mb-2">{t.releaseDate}</h2>
                    <p className="text-white">{product.releaseDate}</p>
                  </div>
                )}

                {product.tags && product.tags.length > 0 && (
                  <div>
                    <h2 className="text-sm font-semibold text-white mb-2">{t.tags}</h2>
                    <div className="flex flex-wrap gap-2">
                      {product.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-gray-700 text-gray-200 rounded-full text-sm"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* FANZA商品は規約上adult側では購入リンクを非表示 */}
                {product.affiliateUrl && product.provider !== 'fanza' && (
                  <AffiliateButton
                    affiliateUrl={product.affiliateUrl}
                    providerLabel={product.providerLabel || ''}
                    price={product.regularPrice || product.price}
                    salePrice={product.salePrice}
                    discount={product.discount}
                  />
                )}

                {/* FANZAで見る直リンク（FANZAソースがある場合） */}
                <FanzaCrossLink
                  fanzaUrl={sources.find(s => s.aspName === 'FANZA')?.affiliateUrl}
                  className="mt-4"
                />
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

          {/* 価格比較セクション */}
          {sourcesWithSales.length > 1 && (
            <div className="mt-8">
              <PriceComparisonServer sources={sourcesWithSales} locale={locale} />
            </div>
          )}

          {/* コスパ分析セクション */}
          {product.price && product.duration && product.duration > 0 && (
            <div className="mt-8">
              <CostPerformanceCard
                price={product.price}
                salePrice={product.salePrice}
                duration={product.duration}
                actressAvgPricePerMin={actressAvgPricePerMin ?? undefined}
                locale={locale}
              />
            </div>
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
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  {primaryPerformerName}の他の作品
                </h2>
                <Link
                  href={`/${locale}/actress/${primaryPerformerId}`}
                  className="inline-flex items-center gap-1 text-sm text-rose-500 hover:text-rose-400 transition-colors"
                >
                  すべて見る
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {performerOtherProducts.map((p) => (
                  <Link
                    key={p.id}
                    href={`/${locale}/products/${p.id}`}
                    className="group bg-gray-800 rounded-lg overflow-hidden hover:ring-2 hover:ring-rose-500/50 transition-all"
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
        />
      )}
    </>
  );
}
