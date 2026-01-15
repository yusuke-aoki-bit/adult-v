import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { JsonLD } from '@/components/JsonLD';
import Breadcrumb from '@/components/Breadcrumb';
import { SocialShareButtons, Pagination } from '@adult-v/shared/components';
import { getSaleProducts, getSaleStats, SaleProduct } from '@/lib/db/queries';
import { generateBaseMetadata, generateBreadcrumbSchema, generateCollectionPageSchema, generateItemListSchema } from '@/lib/seo';
import { localizedHref } from '@adult-v/shared/i18n';

export const revalidate = 1800; // 30分キャッシュ

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string; asp?: string; minDiscount?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = process.env['NEXT_PUBLIC_SITE_URL'] || 'https://example.com';

  const title = locale === 'ja'
    ? 'セール中の作品一覧 | 割引・キャンペーン情報'
    : 'On Sale Videos | Discounts & Promotions';
  const description = locale === 'ja'
    ? '今だけの限定セール・割引キャンペーン中の作品を一覧表示。最大90%OFFのお得な作品をチェック！'
    : 'Browse all videos currently on sale. Check out great deals with discounts up to 90% off!';

  const metadata = generateBaseMetadata(
    title,
    description,
    undefined,
    localizedHref('/sales', locale),
    undefined,
    locale,
  );

  return {
    ...metadata,
    alternates: {
      canonical: `${baseUrl}/sales`,
      languages: {
        'ja': `${baseUrl}/sales`,
        'en': `${baseUrl}/sales?hl=en`,
        'zh': `${baseUrl}/sales?hl=zh`,
        'zh-TW': `${baseUrl}/sales?hl=zh-TW`,
        'ko': `${baseUrl}/sales?hl=ko`,
        'x-default': `${baseUrl}/sales`,
      },
    },
  };
}

// 終了時間のフォーマット
function formatEndTime(endAt: Date | null, locale: string): string | null {
  if (!endAt) return null;
  const now = new Date();
  const end = new Date(endAt);
  const diffMs = end.getTime() - now.getTime();

  if (diffMs <= 0) return locale === 'ja' ? '終了間近' : 'Ending soon';

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return locale === 'ja' ? `残り${diffDays}日` : `${diffDays} days left`;
  }
  if (diffHours > 0) {
    return locale === 'ja' ? `残り${diffHours}時間` : `${diffHours} hours left`;
  }
  return locale === 'ja' ? '間もなく終了' : 'Ending soon';
}

export default async function SalesPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const resolvedSearchParams = await searchParams;
  const tNav = await getTranslations({ locale, namespace: 'nav' });

  const page = parseInt(resolvedSearchParams.page || '1', 10);
  const perPage = 48;
  const aspFilter = resolvedSearchParams.asp;
  const minDiscount = parseInt(resolvedSearchParams.minDiscount || '0', 10);

  // セール商品を取得（最大500件）
  const allSaleProducts = await getSaleProducts({ limit: 500 });
  const saleStats = await getSaleStats();

  // フィルタリング
  let filteredProducts = allSaleProducts;
  if (aspFilter) {
    filteredProducts = filteredProducts.filter(p => p.aspName.toLowerCase() === aspFilter.toLowerCase());
  }
  if (minDiscount > 0) {
    filteredProducts = filteredProducts.filter(p => p.discountPercent >= minDiscount);
  }

  // ページネーション
  const totalCount = filteredProducts.length;
  const totalPages = Math.ceil(totalCount / perPage);
  const startIndex = (page - 1) * perPage;
  const paginatedProducts = filteredProducts.slice(startIndex, startIndex + perPage);

  // ASP別の集計
  const aspCounts = allSaleProducts.reduce((acc, p) => {
    acc[p.aspName] = (acc[p.aspName] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // 統計情報を計算
  const maxDiscount = allSaleProducts.length > 0
    ? Math.max(...allSaleProducts.map(p => p.discountPercent))
    : 0;
  const avgDiscount = allSaleProducts.length > 0
    ? Math.round(allSaleProducts.reduce((sum, p) => sum + p.discountPercent, 0) / allSaleProducts.length)
    : 0;

  // パンくずリスト
  const breadcrumbItems = [
    { name: tNav('home'), url: localizedHref('/', locale) },
    { name: locale === 'ja' ? 'セール' : 'Sales', url: localizedHref('/sales', locale) },
  ];

  // ItemListSchema
  const itemListData = paginatedProducts.slice(0, 10).map((product) => ({
    name: product.title,
    url: localizedHref(`/products/${product.normalizedProductId || product.productId}`, locale),
    image: product.thumbnailUrl ?? undefined,
  }));

  return (
    <div className="theme-body min-h-screen">
      <JsonLD
        data={[
          generateBreadcrumbSchema(breadcrumbItems),
          generateCollectionPageSchema(
            locale === 'ja' ? 'セール中の作品一覧' : 'On Sale Videos',
            locale === 'ja' ? '割引・キャンペーン中の作品' : 'Discounted videos and promotions',
            localizedHref('/sales', locale),
            locale,
          ),
          generateItemListSchema(itemListData, locale === 'ja' ? 'セール中の作品' : 'On Sale Videos'),
        ]}
      />

      <section className="py-4 md:py-6">
        <div className="container mx-auto px-4">
          <Breadcrumb
            items={[
              { label: tNav('home'), href: localizedHref('/', locale) },
              { label: locale === 'ja' ? 'セール' : 'Sales' },
            ]}
            className="mb-3"
          />

          {/* ヘッダー */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-2 flex items-center gap-2">
                <span className="text-3xl">🔥</span>
                {locale === 'ja' ? 'セール中の作品' : 'On Sale Videos'}
              </h1>
              <p className="text-gray-400">
                {locale === 'ja'
                  ? `${totalCount.toLocaleString()}件のセール中作品`
                  : `${totalCount.toLocaleString()} items on sale`}
              </p>
            </div>
            <SocialShareButtons
              title={locale === 'ja' ? 'セール中の作品一覧' : 'On Sale Videos'}
              compact
              hashtags={['セール', '割引']}
            />
          </div>

          {/* 統計情報 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-linear-to-br from-orange-500/20 to-red-500/20 border border-orange-500/30 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-orange-400">{saleStats.totalSales.toLocaleString()}</p>
              <p className="text-xs text-gray-400">{locale === 'ja' ? 'セール中' : 'On Sale'}</p>
            </div>
            <div className="bg-linear-to-br from-pink-500/20 to-rose-500/20 border border-pink-500/30 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-pink-400">{maxDiscount}%</p>
              <p className="text-xs text-gray-400">{locale === 'ja' ? '最大割引' : 'Max Discount'}</p>
            </div>
            <div className="bg-linear-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-blue-400">{avgDiscount}%</p>
              <p className="text-xs text-gray-400">{locale === 'ja' ? '平均割引' : 'Avg Discount'}</p>
            </div>
            <div className="bg-linear-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-green-400">{Object.keys(aspCounts).length}</p>
              <p className="text-xs text-gray-400">{locale === 'ja' ? '参加サイト' : 'Sites'}</p>
            </div>
          </div>

          {/* ASPフィルター */}
          <div className="flex flex-wrap gap-2 mb-6">
            <Link
              href={localizedHref('/sales', locale)}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                !aspFilter
                  ? 'bg-rose-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {locale === 'ja' ? 'すべて' : 'All'} ({allSaleProducts.length})
            </Link>
            {Object.entries(aspCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([asp, count]) => (
                <Link
                  key={asp}
                  href={localizedHref(`/sales?asp=${asp.toLowerCase()}`, locale)}
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                    aspFilter?.toLowerCase() === asp.toLowerCase()
                      ? 'bg-rose-500 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {asp} ({count})
                </Link>
              ))}
          </div>

          {/* 割引率フィルター */}
          <div className="flex flex-wrap gap-2 mb-6">
            {[0, 30, 50, 70].map((discount) => (
              <Link
                key={discount}
                href={localizedHref(
                  discount === 0
                    ? `/sales${aspFilter ? `?asp=${aspFilter}` : ''}`
                    : `/sales?minDiscount=${discount}${aspFilter ? `&asp=${aspFilter}` : ''}`,
                  locale
                )}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                  minDiscount === discount
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {discount === 0
                  ? (locale === 'ja' ? '割引率' : 'Discount')
                  : `${discount}%+`}
              </Link>
            ))}
          </div>

          {/* 商品一覧 */}
          {paginatedProducts.length === 0 ? (
            <p className="text-gray-400 text-center py-12">
              {locale === 'ja' ? 'セール中の作品がありません' : 'No items on sale'}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                {paginatedProducts.map((product) => (
                  <SaleProductCard
                    key={`${product.productId}-${product.aspName}`}
                    product={product}
                    locale={locale}
                  />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="mt-8">
                  <Pagination
                    total={totalCount}
                    page={page}
                    perPage={perPage}
                    basePath={localizedHref('/sales', locale)}
                    queryParams={{
                      ...(aspFilter && { asp: aspFilter }),
                      ...(minDiscount > 0 && { minDiscount: String(minDiscount) }),
                    }}
                  />
                </div>
              )}
            </>
          )}

          {/* 注意書き */}
          <div className="mt-8 p-4 bg-gray-800/50 rounded-lg text-xs text-gray-400">
            <p>
              {locale === 'ja'
                ? '※ セール情報は各サイトから取得しており、実際の価格・終了時期と異なる場合があります。購入前に必ず各サイトでご確認ください。'
                : '※ Sale information is fetched from each site and may differ from actual prices and end dates. Please verify on each site before purchasing.'}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

// セール商品カードコンポーネント
function SaleProductCard({
  product,
  locale,
}: {
  product: SaleProduct;
  locale: string;
}) {
  const productUrl = localizedHref(`/products/${product.normalizedProductId || product.productId}`, locale);
  const endTimeText = formatEndTime(product.endAt, locale);

  return (
    <div className="group relative bg-gray-800 rounded-lg overflow-hidden hover:ring-2 hover:ring-rose-500 transition-all">
      {/* 割引バッジ */}
      <div className="absolute top-2 left-2 z-10 px-2 py-1 bg-linear-to-r from-orange-500 to-red-500 rounded text-white text-xs font-bold">
        -{product.discountPercent}%
      </div>

      {/* ASPバッジ */}
      <div className="absolute top-2 right-2 z-10 px-2 py-0.5 bg-black/70 rounded text-white text-[10px]">
        {product.aspName}
      </div>

      {/* 画像 */}
      <Link href={productUrl} className="block aspect-[3/4] relative">
        {product.thumbnailUrl ? (
          <Image
            src={product.thumbnailUrl}
            alt={product.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
          />
        ) : (
          <div className="w-full h-full bg-gray-700 flex items-center justify-center text-gray-500">
            No Image
          </div>
        )}
      </Link>

      {/* 情報 */}
      <div className="p-2">
        <Link href={productUrl}>
          <h3 className="text-xs text-white line-clamp-2 mb-1 group-hover:text-rose-400 transition-colors">
            {product.title}
          </h3>
        </Link>

        {/* 出演者 */}
        {product.performers.length > 0 && (
          <p className="text-[10px] text-gray-400 truncate mb-1">
            {product.performers.map(p => p.name).join(', ')}
          </p>
        )}

        {/* 価格 */}
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-sm font-bold text-rose-400">
            ¥{product.salePrice.toLocaleString()}
          </span>
          <span className="text-[10px] text-gray-500 line-through">
            ¥{product.regularPrice.toLocaleString()}
          </span>
        </div>

        {/* 終了時間 */}
        {endTimeText && (
          <p className="text-[10px] text-orange-400">
            {endTimeText}
          </p>
        )}

        {/* 購入CTA */}
        {product.affiliateUrl && (
          <a
            href={product.affiliateUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="mt-2 block w-full py-1.5 text-center text-xs font-bold text-white bg-linear-to-r from-rose-500 to-pink-500 hover:from-rose-400 hover:to-pink-400 rounded transition-all"
          >
            {locale === 'ja' ? `${product.aspName}で購入` : `Buy on ${product.aspName}`}
          </a>
        )}
      </div>
    </div>
  );
}
