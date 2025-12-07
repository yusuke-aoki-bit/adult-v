import { notFound } from 'next/navigation';
import { JsonLD } from '@/components/JsonLD';
import ProductImageGallery from '@/components/ProductImageGallery';
import ProductVideoPlayer from '@/components/ProductVideoPlayer';
import Breadcrumb, { type BreadcrumbItem } from '@/components/Breadcrumb';
import RelatedProducts from '@/components/RelatedProducts';
import ProductDetailInfo from '@/components/ProductDetailInfo';
import FavoriteButton from '@/components/FavoriteButton';
import ViewTracker from '@/components/ViewTracker';
import AffiliateButton from '@/components/AffiliateButton';
import { getProductById, searchProductByProductId, getProductSources } from '@/lib/db/queries';
import { isSubscriptionSite } from '@/lib/image-utils';
import { getRelatedProducts } from '@/lib/db/recommendations';
import { generateBaseMetadata, generateProductSchema, generateBreadcrumbSchema, generateOptimizedDescription } from '@/lib/seo';
import { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export const dynamic = 'force-dynamic';

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

    // SEO最適化されたメタディスクリプション生成
    const optimizedDescription = generateOptimizedDescription(
      product.title,
      product.actressName,
      product.tags,
      product.releaseDate,
      product.normalizedProductId || product.id,
    );

    return {
      ...generateBaseMetadata(
        product.title,
        optimizedDescription,
        product.imageUrl,
        `/${locale}/products/${product.id}`,
      ),
      alternates: {
        languages: {
          'ja': `${baseUrl}/ja/products/${product.id}`,
          'en': `${baseUrl}/en/products/${product.id}`,
          'zh': `${baseUrl}/zh/products/${product.id}`,
          'ko': `${baseUrl}/ko/products/${product.id}`,
          'x-default': `${baseUrl}/ja/products/${product.id}`,
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

  // Try to get product by normalized ID first, then by database ID
  let product = await searchProductByProductId(id, locale);
  if (!product && !isNaN(parseInt(id))) {
    product = await getProductById(id, locale);
  }
  if (!product) notFound();

  const basePath = `/${locale}/products/${product.id}`;

  // Structured data
  const productSchema = generateProductSchema(
    product.title,
    product.description || '',
    product.imageUrl,
    basePath,
    product.regularPrice || product.price,
    product.providerLabel,
    undefined, // aggregateRating
    product.salePrice,
    product.currency || 'JPY'
  );

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: tNav('home'), url: `/${locale}` },
    { name: product.title, url: basePath },
  ]);

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

  // E-E-A-T強化: 全ASPソース情報を取得
  const productId = typeof product.id === 'string' ? parseInt(product.id) : product.id;
  const sources = await getProductSources(productId);

  return (
    <>
      <JsonLD data={productSchema} />
      <JsonLD data={breadcrumbSchema} />

      <div className="bg-gray-900 min-h-screen">
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
                mainImage={product.imageUrl}
                sampleImages={product.sampleImages}
                productTitle={product.title}
              />

              {/* Product Info */}
              <div className="space-y-6">
                <div>
                  <div className="flex items-start gap-3 mb-2">
                    <h1 className="text-3xl font-bold text-white flex-1">{product.title}</h1>
                    <FavoriteButton
                      type="product"
                      id={productId}
                      title={product.title}
                      thumbnail={product.imageUrl}
                      size="lg"
                    />
                  </div>
                  <p className="text-gray-300">{product.providerLabel}</p>
                  <p className="text-sm text-gray-400 mt-2">
                    作品ID: {product.normalizedProductId || product.id}
                    {sources.length > 0 && sources[0].originalProductId &&
                      ` / メーカー品番: ${sources[0].originalProductId}`}
                  </p>
                </div>

                {product.performers && product.performers.length > 0 ? (
                  <div>
                    <h2 className="text-sm font-semibold text-white mb-2">
                      {product.performers.length === 1 ? tCommon('actress') : '出演者'}
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      {product.performers.map((performer) => (
                        <Link
                          key={performer.id}
                          href={`/${locale}/actress/${performer.id}`}
                          className="text-rose-600 hover:text-green-700 hover:underline"
                        >
                          {performer.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : product.actressName ? (
                  <div>
                    <h2 className="text-sm font-semibold text-white mb-2">{tCommon('actress')}</h2>
                    {product.actressId ? (
                      <Link
                        href={`/${locale}/actress/${product.actressId}`}
                        className="text-rose-600 hover:text-green-700 hover:underline"
                      >
                        {product.actressName}
                      </Link>
                    ) : (
                      <p className="text-white">{product.actressName}</p>
                    )}
                  </div>
                ) : null}

                {product.description && (
                  <div>
                    <h2 className="text-sm font-semibold text-white mb-2">説明</h2>
                    <p className="text-white whitespace-pre-wrap">{product.description}</p>
                  </div>
                )}

                {product.price && (
                  <div>
                    <h2 className="text-sm font-semibold text-white mb-2">価格</h2>
                    <p className="text-2xl font-bold text-white">
                      {isSubscriptionSite(product.provider) && <span className="text-base text-gray-400 mr-1">月額</span>}
                      ¥{product.price.toLocaleString()}
                    </p>
                  </div>
                )}

                {product.releaseDate && (
                  <div>
                    <h2 className="text-sm font-semibold text-white mb-2">発売日</h2>
                    <p className="text-white">{product.releaseDate}</p>
                  </div>
                )}

                {product.tags && product.tags.length > 0 && (
                  <div>
                    <h2 className="text-sm font-semibold text-white mb-2">タグ</h2>
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

                {product.affiliateUrl && (
                  <AffiliateButton
                    affiliateUrl={product.affiliateUrl}
                    providerLabel={product.providerLabel}
                    aspName={sources[0]?.aspName}
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

          {/* 関連作品セクション */}
          {relatedProducts.length > 0 && (
            <RelatedProducts products={relatedProducts} title="関連作品" />
          )}
        </div>
      </div>

      {/* View tracking */}
      <ViewTracker productId={productId} />
    </>
  );
}
