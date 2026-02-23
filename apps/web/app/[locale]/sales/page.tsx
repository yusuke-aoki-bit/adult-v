import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { unstable_cache } from 'next/cache';
import { JsonLD } from '@/components/JsonLD';
import Breadcrumb from '@/components/Breadcrumb';
import { SocialShareButtons, Pagination } from '@adult-v/shared/components';
import { getSaleProducts, getSaleStats, SaleProduct } from '@/lib/db/queries';
import {
  generateBaseMetadata,
  generateBreadcrumbSchema,
  generateCollectionPageSchema,
  generateItemListSchema,
} from '@/lib/seo';
import { localizedHref } from '@adult-v/shared/i18n';

// getTranslationsがheaders()を呼ぶためISR(revalidate)は無効 → force-dynamic
export const dynamic = 'force-dynamic';

const pageTexts = {
  ja: {
    metaTitle: 'セール中の作品一覧 | 割引・キャンペーン情報',
    metaDescription: '今だけの限定セール・割引キャンペーン中の作品を一覧表示。最大90%OFFのお得な作品をチェック！',
    sales: 'セール',
    onSaleVideos: 'セール中の作品',
    onSaleVideosTitle: 'セール中の作品一覧',
    discountedDescription: '割引・キャンペーン中の作品',
    itemsOnSale: (count: string) => `${count}件のセール中作品`,
    onSale: 'セール中',
    maxDiscount: '最大割引',
    avgDiscount: '平均割引',
    sites: '参加サイト',
    all: 'すべて',
    discount: '割引率',
    noItems: 'セール中の作品がありません',
    disclaimer:
      '※ セール情報は各サイトから取得しており、実際の価格・終了時期と異なる場合があります。購入前に必ず各サイトでご確認ください。',
    endingSoon: '終了間近',
    endingSoonAlt: '間もなく終了',
    daysLeft: (days: number) => `残り${days}日`,
    hoursLeft: (hours: number) => `残り${hours}時間`,
    endingSoonBadge: '間もなく終了!',
    buyNow: (aspName: string) => `今すぐ${aspName}で購入`,
  },
  en: {
    metaTitle: 'On Sale Videos | Discounts & Promotions',
    metaDescription: 'Browse all videos currently on sale. Check out great deals with discounts up to 90% off!',
    sales: 'Sales',
    onSaleVideos: 'On Sale Videos',
    onSaleVideosTitle: 'On Sale Videos',
    discountedDescription: 'Discounted videos and promotions',
    itemsOnSale: (count: string) => `${count} items on sale`,
    onSale: 'On Sale',
    maxDiscount: 'Max Discount',
    avgDiscount: 'Avg Discount',
    sites: 'Sites',
    all: 'All',
    discount: 'Discount',
    noItems: 'No items on sale',
    disclaimer:
      '※ Sale information is fetched from each site and may differ from actual prices and end dates. Please verify on each site before purchasing.',
    endingSoon: 'Ending soon',
    endingSoonAlt: 'Ending soon',
    daysLeft: (days: number) => `${days} days left`,
    hoursLeft: (hours: number) => `${hours} hours left`,
    endingSoonBadge: 'Ending Soon!',
    buyNow: (aspName: string) => `Buy Now on ${aspName}`,
  },
} as const;

function getPageText(locale: string) {
  return pageTexts[locale as keyof typeof pageTexts] || pageTexts.ja;
}

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string; asp?: string; minDiscount?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const pt = getPageText(locale);
  const baseUrl = process.env['NEXT_PUBLIC_SITE_URL'] || 'https://example.com';

  const title = pt.metaTitle;
  const description = pt.metaDescription;

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
        ja: `${baseUrl}/sales`,
        en: `${baseUrl}/sales?hl=en`,
        zh: `${baseUrl}/sales?hl=zh`,
        'zh-TW': `${baseUrl}/sales?hl=zh-TW`,
        ko: `${baseUrl}/sales?hl=ko`,
        'x-default': `${baseUrl}/sales`,
      },
    },
  };
}

// 終了時間のフォーマット
function formatEndTime(endAt: Date | null, locale: string): string | null {
  if (!endAt) return null;
  const pt = getPageText(locale);
  const now = new Date();
  const end = new Date(endAt);
  const diffMs = end.getTime() - now.getTime();

  if (diffMs <= 0) return pt.endingSoon;

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return pt.daysLeft(diffDays);
  }
  if (diffHours > 0) {
    return pt.hoursLeft(diffHours);
  }
  return pt.endingSoonAlt;
}

// unstable_cacheでDBクエリをキャッシュ（1800秒 = 30分）
const getCachedSalePageData = unstable_cache(
  async () => {
    const [allSaleProducts, saleStats] = await Promise.all([getSaleProducts({ limit: 500 }), getSaleStats()]);
    return { allSaleProducts, saleStats };
  },
  ['sales-page-data'],
  { revalidate: 1800, tags: ['sale-products'] },
);

export default async function SalesPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const pt = getPageText(locale);
  const resolvedSearchParams = await searchParams;
  const tNav = await getTranslations({ locale, namespace: 'nav' });

  const page = Math.max(1, Math.min(parseInt(resolvedSearchParams.page || '1', 10), 500));
  const perPage = 48;
  const aspFilter = resolvedSearchParams.asp;
  const minDiscount = Math.max(0, Math.min(parseInt(resolvedSearchParams.minDiscount || '0', 10), 100));

  // セール商品を取得（unstable_cacheで30分キャッシュ）
  const { allSaleProducts, saleStats } = await getCachedSalePageData();

  // フィルタリング
  let filteredProducts = allSaleProducts;
  if (aspFilter) {
    filteredProducts = filteredProducts.filter((p) => p.aspName.toLowerCase() === aspFilter.toLowerCase());
  }
  if (minDiscount > 0) {
    filteredProducts = filteredProducts.filter((p) => p.discountPercent >= minDiscount);
  }

  // ページネーション
  const totalCount = filteredProducts.length;
  const totalPages = Math.ceil(totalCount / perPage);
  const startIndex = (page - 1) * perPage;
  const paginatedProducts = filteredProducts.slice(startIndex, startIndex + perPage);

  // ASP別の集計
  const aspCounts = allSaleProducts.reduce(
    (acc, p) => {
      acc[p.aspName] = (acc[p.aspName] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  // 統計情報を計算
  const maxDiscount = allSaleProducts.length > 0 ? Math.max(...allSaleProducts.map((p) => p.discountPercent)) : 0;
  const avgDiscount =
    allSaleProducts.length > 0
      ? Math.round(allSaleProducts.reduce((sum, p) => sum + p.discountPercent, 0) / allSaleProducts.length)
      : 0;

  // パンくずリスト
  const breadcrumbItems = [
    { name: tNav('home'), url: localizedHref('/', locale) },
    { name: pt.sales, url: localizedHref('/sales', locale) },
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
            pt.onSaleVideosTitle,
            pt.discountedDescription,
            localizedHref('/sales', locale),
            locale,
          ),
          generateItemListSchema(itemListData, pt.onSaleVideos),
        ]}
      />

      <section className="py-4 md:py-6">
        <div className="container mx-auto px-4">
          <Breadcrumb
            items={[{ label: tNav('home'), href: localizedHref('/', locale) }, { label: pt.sales }]}
            className="mb-3"
          />

          {/* ヘッダー */}
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="mb-2 flex items-center gap-2 text-2xl font-bold text-white md:text-3xl">
                <span className="text-3xl">🔥</span>
                {pt.onSaleVideos}
              </h1>
              <p className="text-gray-400">{pt.itemsOnSale(totalCount.toLocaleString())}</p>
            </div>
            <SocialShareButtons title={pt.onSaleVideosTitle} compact hashtags={['セール', '割引']} />
          </div>

          {/* 統計情報 */}
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-orange-500/30 bg-linear-to-br from-orange-500/20 to-red-500/20 p-4 text-center">
              <p className="text-2xl font-bold text-orange-400">{saleStats.totalSales.toLocaleString()}</p>
              <p className="text-xs text-gray-400">{pt.onSale}</p>
            </div>
            <div className="rounded-lg border border-pink-500/30 bg-linear-to-br from-pink-500/20 to-rose-500/20 p-4 text-center">
              <p className="text-2xl font-bold text-pink-400">{maxDiscount}%</p>
              <p className="text-xs text-gray-400">{pt.maxDiscount}</p>
            </div>
            <div className="rounded-lg border border-blue-500/30 bg-linear-to-br from-blue-500/20 to-cyan-500/20 p-4 text-center">
              <p className="text-2xl font-bold text-blue-400">{avgDiscount}%</p>
              <p className="text-xs text-gray-400">{pt.avgDiscount}</p>
            </div>
            <div className="rounded-lg border border-green-500/30 bg-linear-to-br from-green-500/20 to-emerald-500/20 p-4 text-center">
              <p className="text-2xl font-bold text-green-400">{Object.keys(aspCounts).length}</p>
              <p className="text-xs text-gray-400">{pt.sites}</p>
            </div>
          </div>

          {/* ASPフィルター */}
          <div className="mb-6 flex flex-wrap gap-2">
            <Link
              href={localizedHref('/sales', locale)}
              className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                !aspFilter ? 'bg-rose-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {pt.all} ({allSaleProducts.length})
            </Link>
            {Object.entries(aspCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([asp, count]) => (
                <Link
                  key={asp}
                  href={localizedHref(`/sales?asp=${asp.toLowerCase()}`, locale)}
                  className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
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
          <div className="mb-6 flex flex-wrap gap-2">
            {[0, 30, 50, 70].map((discount) => (
              <Link
                key={discount}
                href={localizedHref(
                  discount === 0
                    ? `/sales${aspFilter ? `?asp=${aspFilter}` : ''}`
                    : `/sales?minDiscount=${discount}${aspFilter ? `&asp=${aspFilter}` : ''}`,
                  locale,
                )}
                className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                  minDiscount === discount ? 'bg-orange-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {discount === 0 ? pt.discount : `${discount}%+`}
              </Link>
            ))}
          </div>

          {/* 商品一覧 */}
          {paginatedProducts.length === 0 ? (
            <p className="py-12 text-center text-gray-400">{pt.noItems}</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {paginatedProducts.map((product) => (
                  <SaleProductCard key={`${product.productId}-${product.aspName}`} product={product} locale={locale} />
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
          <div className="mt-8 rounded-lg bg-gray-800/50 p-4 text-xs text-gray-400">
            <p>{pt.disclaimer}</p>
          </div>
        </div>
      </section>
    </div>
  );
}

// 緊急度を計算
function getUrgencyLevel(endAt: Date | null): 'critical' | 'urgent' | 'normal' | null {
  if (!endAt) return null;
  const now = new Date();
  const end = new Date(endAt);
  const diffMs = end.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours <= 1) return 'critical'; // 1時間以内
  if (diffHours <= 6) return 'urgent'; // 6時間以内
  return 'normal';
}

// セール商品カードコンポーネント（CTA大型化版）
function SaleProductCard({ product, locale }: { product: SaleProduct; locale: string }) {
  const pt = getPageText(locale);
  const productUrl = localizedHref(`/products/${product.normalizedProductId || product.productId}`, locale);
  const endTimeText = formatEndTime(product.endAt, locale);
  const urgency = getUrgencyLevel(product.endAt);

  return (
    <div className="group relative overflow-hidden rounded-lg bg-gray-800 transition-all hover:ring-2 hover:ring-rose-500">
      {/* 緊急セールバッジ（1時間以内） */}
      {urgency === 'critical' && (
        <div className="absolute top-0 right-0 left-0 z-20 animate-pulse bg-red-600 py-1 text-center text-xs font-bold text-white">
          {pt.endingSoonBadge}
        </div>
      )}

      {/* 割引バッジ - 大型化 */}
      <div
        className={`absolute ${urgency === 'critical' ? 'top-8' : 'top-2'} left-2 z-10 rounded-lg bg-linear-to-r from-red-600 to-orange-500 px-2.5 py-1.5 text-sm font-bold text-white shadow-lg`}
      >
        -{product.discountPercent}%
      </div>

      {/* ASPバッジ */}
      <div
        className={`absolute ${urgency === 'critical' ? 'top-8' : 'top-2'} right-2 z-10 rounded bg-black/70 px-2 py-0.5 text-[10px] text-white`}
      >
        {product.aspName}
      </div>

      {/* 画像 */}
      <Link href={productUrl} className={`relative block aspect-[3/4] ${urgency === 'critical' ? 'mt-6' : ''}`}>
        {product.thumbnailUrl ? (
          <Image
            src={product.thumbnailUrl}
            alt={product.title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gray-700 text-gray-500">No Image</div>
        )}
      </Link>

      {/* 情報 */}
      <div className="p-3">
        <Link href={productUrl}>
          <h3 className="mb-1.5 line-clamp-2 text-xs text-white transition-colors group-hover:text-rose-400">
            {product.title}
          </h3>
        </Link>

        {/* 出演者 */}
        {product.performers.length > 0 && (
          <p className="mb-1.5 truncate text-[10px] text-gray-400">
            {product.performers.map((p) => p.name).join(', ')}
          </p>
        )}

        {/* 価格 - 強調 */}
        <div className="mb-2 flex items-baseline gap-2">
          <span className="text-base font-bold text-rose-400">¥{product.salePrice.toLocaleString()}</span>
          <span className="text-xs text-gray-500 line-through">¥{product.regularPrice.toLocaleString()}</span>
        </div>

        {/* 終了時間 - 緊急度で色分け */}
        {endTimeText && (
          <p
            className={`mb-2 text-xs font-medium ${
              urgency === 'critical'
                ? 'animate-pulse text-red-400'
                : urgency === 'urgent'
                  ? 'text-orange-400'
                  : 'text-yellow-400'
            }`}
          >
            {urgency === 'critical' && '⚠️ '}
            {endTimeText}
          </p>
        )}

        {/* 購入CTA - 大型化・常時表示 */}
        {product.affiliateUrl && (
          <a
            href={product.affiliateUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className={`block w-full rounded-lg py-2.5 text-center text-sm font-bold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl ${
              urgency === 'critical'
                ? 'bg-linear-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400'
                : 'bg-linear-to-r from-rose-500 to-pink-500 hover:from-rose-400 hover:to-pink-400'
            }`}
          >
            {pt.buyNow(product.aspName)}
          </a>
        )}
      </div>
    </div>
  );
}
