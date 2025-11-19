import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  getProductById,
  getProductsByActress,
  getActressById,
} from '@/lib/db/queries';
import { providerMeta } from '@/lib/providers';
import { getCategoryName } from '@/lib/categories';
import ProductCard from '@/components/ProductCard';
import CampaignCard from '@/components/CampaignCard';
import { JsonLD } from '@/components/JsonLD';
import {
  generateBaseMetadata,
  generateProductSchema,
  generateVideoObjectSchema,
  generateBreadcrumbSchema,
} from '@/lib/seo';
import { Metadata } from 'next';

// 動的生成（DBから毎回取得）
export const dynamic = 'force-dynamic';

interface ProductPageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductById(id);

  if (!product) {
    return {};
  }

  const actressName = product.actressName ? ` - ${product.actressName}` : '';

  return generateBaseMetadata(
    `${product.title}${actressName} - 作品詳細`,
    product.reviewHighlight || product.description,
    product.imageUrl,
    `/product/${product.id}`,
  );
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  const product = await getProductById(id);

  if (!product) {
    notFound();
  }

  const provider = providerMeta[product.provider];
  const actress = product.actressId ? await getActressById(product.actressId) : undefined;
  const allRelatedProducts = await getProductsByActress(product.actressId);
  const relatedProducts = allRelatedProducts
    .filter((p) => p.id !== product.id)
    .slice(0, 4);
  // キャンペーンデータは現在DBに未実装
  const providerCampaigns: { id: string; title: string; description: string; provider: string; discountType: string; discountValue: number; endDate: string; url: string; }[] = [];

  const breadcrumbItems = [{ name: 'ホーム', url: '/' }];
  if (product.actressId && product.actressName) {
    breadcrumbItems.push({ name: product.actressName, url: `/actress/${product.actressId}` });
  }
  breadcrumbItems.push({ name: product.title, url: `/product/${product.id}` });

  const breadcrumbSchema = generateBreadcrumbSchema(breadcrumbItems);

  const productSchema = generateProductSchema(
    product.title,
    product.description,
    product.imageUrl,
    `/product/${product.id}`,
    product.price,
    product.providerLabel,
    product.rating && product.reviewCount
      ? {
          ratingValue: product.rating,
          reviewCount: product.reviewCount,
        }
      : undefined,
  );

  const videoSchema = generateVideoObjectSchema(
    product.title,
    product.description,
    product.imageUrl,
    product.affiliateUrl,
    product.duration,
    product.releaseDate,
  );

  return (
    <>
      <JsonLD data={breadcrumbSchema} />
      <JsonLD data={productSchema} />
      <JsonLD data={videoSchema} />
      <div className="min-h-screen bg-gray-50 py-10">
      <div className="container mx-auto px-4 space-y-10">
        {/* パンくずリスト */}
        <nav className="text-sm text-gray-500 flex items-center gap-2">
          <Link href="/" className="hover:text-gray-900">
            ホーム
          </Link>
          {product.actressId && product.actressName && (
            <>
              <span>/</span>
              <Link href={`/actress/${product.actressId}`} className="hover:text-gray-900">
                {product.actressName}
              </Link>
            </>
          )}
          <span>/</span>
          <span className="text-gray-900">{product.title}</span>
        </nav>

        {/* 商品詳細 */}
        <section className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2">
            <div className="relative h-[480px] lg:h-full">
              <Image
                src={product.imageUrl}
                alt={product.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
                priority
              />
              <div className="absolute top-6 left-6 flex gap-2">
                <span
                  className={`text-xs font-semibold px-3 py-1 rounded-full text-white bg-gradient-to-r ${provider.accentClass}`}
                >
                  {provider.label}
                </span>
                {product.isNew && (
                  <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white/90 text-gray-900">
                    NEW
                  </span>
                )}
              </div>
              {product.discount && (
                <span className="absolute bottom-6 right-6 bg-gray-900 text-white text-sm font-semibold px-4 py-2 rounded-full">
                  {product.discount}%OFF
                </span>
              )}
            </div>

            <div className="p-8 lg:p-10 space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.4em] text-gray-400">
                    {getCategoryName(product.category)}
                  </p>
                  <h1 className="text-3xl font-bold text-gray-900 mt-2">{product.title}</h1>
                  <p className="text-sm text-gray-500 mt-1">
                  {product.releaseDate ?? '配信日未定'}
                  {product.duration && ` / ${product.duration}分`}
                  {product.format && ` / ${product.format}`}
                  </p>
                </div>
              {product.actressId && product.actressName && (
                <Link
                  href={`/actress/${product.actressId}`}
                  className="text-sm font-semibold text-gray-600 hover:text-gray-900"
                >
                  {product.actressName} →
                </Link>
              )}
              </div>

              {product.reviewHighlight && (
                <p className="text-sm text-gray-900 bg-gray-100 rounded-2xl px-4 py-3 italic">
                  “{product.reviewHighlight}”
                </p>
              )}

              <p className="text-gray-700 leading-relaxed">{product.description}</p>

              {product.tags && (
                <div className="flex flex-wrap gap-2">
                  {product.tags.map((tag) => (
                    <span key={tag} className="px-3 py-1 rounded-full bg-gray-100 text-sm text-gray-600">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {product.rating && (
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <span className="text-lg font-semibold text-gray-900">{product.rating.toFixed(1)}</span>
                  <span>({product.reviewCount ?? 0}件)</span>
                </div>
              )}

              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs text-gray-500">{product.providerLabel}</p>
                  <p className="text-4xl font-bold text-gray-900">¥{product.price.toLocaleString()}</p>
                </div>
                <a
                  href={product.affiliateUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-2xl bg-gray-900 text-white font-semibold"
                >
                  {product.ctaLabel ?? '配信ページへ'}
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </a>
              </div>
              <p className="text-xs text-gray-400">※リンク先は各配信サービスのアフィリエイトURLです</p>
            </div>
          </div>
        </section>

        {/* 女優情報 */}
        {actress && (
          <section className="bg-gray-900 text-white rounded-3xl p-8 flex flex-col gap-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-white/60">Actress</p>
                <h2 className="text-3xl font-semibold">{actress.name}</h2>
                <p className="text-white/70">{actress.catchcopy}</p>
              </div>
              <div className="flex gap-4 text-center">
                <Metric label="出演数" value={`${actress.metrics.releaseCount}本`} />
                <Metric label="トレンド" value={actress.metrics.trendingScore} />
                <Metric label="ファンスコア" value={`${actress.metrics.fanScore}%`} />
              </div>
            </div>
            <p className="text-sm text-white/80">{actress.description}</p>
            <div className="flex flex-wrap gap-2">
              {actress.tags.map((tag) => (
                <span key={tag} className="px-3 py-1 rounded-full border border-white/20 text-xs uppercase">
                  {tag}
                </span>
              ))}
            </div>
            <Link
              href={`/actress/${actress.id}`}
              className="inline-flex items-center gap-2 text-sm font-semibold text-white underline"
            >
              女優ページで詳しく見る →
            </Link>
          </section>
        )}

        {/* 関連商品 */}
        {relatedProducts.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">同女優の他作品</h2>
              {product.actressId && (
                <Link
                  href={`/actress/${product.actressId}`}
                  className="text-sm font-semibold text-gray-600 hover:text-gray-900"
                >
                  すべて見る →
                </Link>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {relatedProducts.map((relatedProduct) => (
                <ProductCard key={relatedProduct.id} product={relatedProduct} />
              ))}
            </div>
          </section>
        )}

        {/* キャンペーン */}
        {providerCampaigns.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900">{provider.label} のキャンペーン</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {providerCampaigns.map((campaign) => (
                <CampaignCard key={campaign.id} campaign={campaign} />
              ))}
            </div>
          </section>
        )}
      </div>
      </div>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <p className="text-xs text-white/60 uppercase tracking-[0.4em]">{label}</p>
      <p className="text-xl font-semibold text-white">{value}</p>
    </div>
  );
}

