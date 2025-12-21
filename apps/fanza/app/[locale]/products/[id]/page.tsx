import { notFound } from 'next/navigation';
import nextDynamic from 'next/dynamic';
import { JsonLD } from '@/components/JsonLD';
import ProductImageGallery from '@/components/ProductImageGallery';
import ProductVideoPlayer from '@/components/ProductVideoPlayer';
import Breadcrumb, { type BreadcrumbItem } from '@/components/Breadcrumb';
import RelatedProducts from '@/components/RelatedProducts';
import ProductDetailInfo from '@/components/ProductDetailInfo';
import '@/components/ProductActions';
import {
  ViewTracker,
} from '@adult-v/shared/components';
import AffiliateButton from '@/components/AffiliateButton';
import FavoriteButton from '@/components/FavoriteButton';
import StickyCta from '@/components/StickyCta';
import { getProductById, searchProductByProductId, getProductSources } from '@/lib/db/queries';
import { isSubscriptionSite } from '@/lib/image-utils';
import { getRelatedProducts } from '@/lib/db/recommendations';
import { generateBaseMetadata, generateProductSchema, generateBreadcrumbSchema, generateOptimizedDescription, generateVideoObjectSchema } from '@/lib/seo';
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
    const optimizedDescription = generateOptimizedDescription(
      product.title,
      product.actressName,
      product.tags,
      product.releaseDate,
      product.normalizedProductId || product.id,
      {
        salePrice: product.salePrice,
        regularPrice: product.regularPrice,
        discount: product.discount,
        rating: product.rating,
        reviewCount: product.reviewCount,
      },
    );

    return {
      ...generateBaseMetadata(
        product.title,
        optimizedDescription,
        product.imageUrl,
        localizedHref(`/products/${product.id}`, locale),
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

  // パンくずリスト用のアイテム作成
  const breadcrumbItems: BreadcrumbItem[] = [
    { label: tNav('home'), href: localizedHref('/', locale) },
  ];

  // 複数女優の場合、それぞれのパンくずリストを追加
  if (product.performers && product.performers.length > 0) {
    product.performers.forEach((performer) => {
      breadcrumbItems.push({
        label: performer.name,
        href: localizedHref(`/actress/${performer.id}`, locale),
      });
    });
  } else if (product.actressName && product.actressId) {
    breadcrumbItems.push({
      label: product.actressName,
      href: localizedHref(`/actress/${product.actressId}`, locale),
    });
  }

  // 最後に商品タイトルを追加（リンクなし）
  breadcrumbItems.push({ label: product.title });

  // 関連作品を取得（FANZAの商品のみ）
  const relatedProducts = await getRelatedProducts(product.id, 12, 'fanza');

  // E-E-A-T強化: 全ASPソース情報を取得
  const productId = typeof product.id === 'string' ? parseInt(product.id) : product.id;
  const sources = await getProductSources(productId);

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
                    <h1 className="text-3xl font-bold theme-text flex-1">{product.title}</h1>
                    <FavoriteButton
                      type="product"
                      id={productId}
                      title={product.title}
                      thumbnail={product.imageUrl}
                      size="lg"
                    />
                  </div>
                  <p className="theme-text-secondary">{product.providerLabel}</p>
                  <p className="text-sm theme-text-muted mt-2">
                    作品ID: {product.normalizedProductId || product.id}
                    {sources.length > 0 && sources[0].originalProductId &&
                      ` / メーカー品番: ${sources[0].originalProductId}`}
                  </p>
                </div>

                {product.performers && product.performers.length > 0 ? (
                  <div>
                    <h2 className="text-sm font-semibold theme-text mb-2">
                      {product.performers.length === 1 ? tCommon('actress') : t.performers}
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      {product.performers.map((performer) => (
                        <Link
                          key={performer.id}
                          href={localizedHref(`/actress/${performer.id}`, locale)}
                          className="text-rose-700 hover:text-rose-800 hover:underline"
                        >
                          {performer.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : product.actressName ? (
                  <div>
                    <h2 className="text-sm font-semibold theme-text mb-2">{tCommon('actress')}</h2>
                    {product.actressId ? (
                      <Link
                        href={localizedHref(`/actress/${product.actressId}`, locale)}
                        className="text-rose-700 hover:text-rose-800 hover:underline"
                      >
                        {product.actressName}
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
                  <div>
                    <h2 className="text-sm font-semibold theme-text mb-2">{t.price}</h2>
                    <p className="text-2xl font-bold theme-text">
                      {product.provider && isSubscriptionSite(product.provider) && <span className="text-base theme-text-muted mr-1">{t.monthly}</span>}
                      ¥{product.price.toLocaleString()}
                    </p>
                  </div>
                )}

                {product.releaseDate && (
                  <div>
                    <h2 className="text-sm font-semibold theme-text mb-2">{t.releaseDate}</h2>
                    <p className="theme-text">{product.releaseDate}</p>
                  </div>
                )}

                {product.tags && product.tags.length > 0 && (
                  <div>
                    <h2 className="text-sm font-semibold theme-text mb-2">{t.tags}</h2>
                    <div className="flex flex-wrap gap-2">
                      {product.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm border border-gray-200"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {product.affiliateUrl && (
                  <AffiliateButton
                    affiliateUrl={product.affiliateUrl}
                    providerLabel={product.providerLabel || ''}
                    price={product.regularPrice || product.price}
                    salePrice={product.salePrice}
                    discount={product.discount}
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
                updatedAt={new Date()}
                performerCount={product.performers?.length || 0}
                tagCount={product.tags?.length || 0}
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
        />
      )}
    </>
  );
}
