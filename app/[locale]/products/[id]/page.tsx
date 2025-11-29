import { notFound } from 'next/navigation';
import Image from 'next/image';
import { JsonLD } from '@/components/JsonLD';
import ProductImageGallery from '@/components/ProductImageGallery';
// 利用規約確認中のため一時非表示
// import ProductVideoPlayer from '@/components/ProductVideoPlayer';
import Breadcrumb, { type BreadcrumbItem } from '@/components/Breadcrumb';
import RelatedProducts from '@/components/RelatedProducts';
import ProductDetailInfo from '@/components/ProductDetailInfo';
import FavoriteButton from '@/components/FavoriteButton';
import ViewTracker from '@/components/ViewTracker';
import { getProductById, searchProductByProductId, getProductSources } from '@/lib/db/queries';
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
    let product = await searchProductByProductId(id);
    if (!product && !isNaN(parseInt(id))) {
      product = await getProductById(id);
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
  let product = await searchProductByProductId(id);
  if (!product && !isNaN(parseInt(id))) {
    product = await getProductById(id);
  }
  if (!product) notFound();

  const basePath = `/${locale}/products/${product.id}`;

  // Structured data
  const productSchema = generateProductSchema(
    product.title,
    product.description || '',
    product.imageUrl,
    basePath,
    product.price,
    product.providerLabel
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

          {/* サンプル動画セクション - 利用規約確認中のため一時非表示 */}
          {/* TODO: 利用規約確認後に再表示
          {product.sampleVideos && product.sampleVideos.length > 0 && (
            <div className="bg-gray-800 rounded-lg shadow-md p-6 mb-6">
              <ProductVideoPlayer
                sampleVideos={product.sampleVideos}
                productTitle={product.title}
              />
            </div>
          )}
          */}

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
                    <p className="text-2xl font-bold text-white">¥{product.price.toLocaleString()}</p>
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
                  <div className="pt-4">
                    <a
                      href={product.affiliateUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full bg-rose-600 text-white text-center py-3 px-6 rounded-lg font-semibold hover:bg-rose-700 transition-colors"
                    >
                      {product.providerLabel}で購入
                    </a>
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
