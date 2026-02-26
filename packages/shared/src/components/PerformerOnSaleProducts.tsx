'use client';

import Link from 'next/link';
import Image from 'next/image';
import { normalizeImageUrl } from '../lib/image-utils';
import { useSiteTheme } from '../contexts/SiteThemeContext';

interface OnSaleProduct {
  id: number;
  title: string;
  normalizedProductId: string | null;
  imageUrl: string | null;
  releaseDate: string | null;
  originalPrice: number | null;
  salePrice: number;
  saleEndAt: string;
  discountPercent: number;
  affiliateUrl?: string | null;
  aspName?: string | null;
}

interface PerformerOnSaleProductsProps {
  products: OnSaleProduct[];
  performerName: string;
  locale: string;
  theme?: 'dark' | 'light';
  translations: {
    title: string;
    description: string;
    off: string;
    endsIn: string;
    endsTomorrow: string;
    endsToday: string;
    yen: string;
    buyNow?: string;
  };
  /** Hide FANZA purchase links (for terms compliance on adult-v) */
  hideFanzaPurchaseLinks?: boolean;
}

const PLACEHOLDER_IMAGE = 'https://placehold.co/300x200/1f2937/ffffff?text=No+Image';

// 残り時間を計算
function getTimeRemaining(
  endDate: string,
  translations: PerformerOnSaleProductsProps['translations'],
): { text: string; isUrgent: boolean } {
  const end = new Date(endDate);
  const now = new Date();
  const diffMs = end.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));

  if (diffHours <= 24) {
    return { text: translations.endsToday, isUrgent: true };
  } else if (diffDays === 1) {
    return { text: translations.endsTomorrow, isUrgent: true };
  } else {
    return { text: translations.endsIn.replace('{days}', String(diffDays)), isUrgent: false };
  }
}

export default function PerformerOnSaleProducts({
  products,
  performerName,
  locale,
  theme: themeProp,
  translations,
  hideFanzaPurchaseLinks,
}: PerformerOnSaleProductsProps) {
  const { theme: contextTheme } = useSiteTheme();
  const theme = themeProp ?? contextTheme;

  if (products.length === 0) {
    return null;
  }

  const isDark = theme === 'dark';

  return (
    <div
      className={`mt-8 rounded-lg p-6 ${isDark ? 'bg-linear-to-br from-red-900/30 to-fuchsia-900/30' : 'bg-linear-to-br from-red-50 to-pink-50'}`}
    >
      <h2 className={`mb-2 flex items-center gap-2 text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
        <svg
          className={`h-6 w-6 ${isDark ? 'text-red-400' : 'text-red-600'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        {translations.title.replace('{name}', performerName)}
      </h2>
      <p className={`mb-4 text-sm ${isDark ? 'text-red-300' : 'text-red-700'}`}>{translations.description}</p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((product) => {
          const timeRemaining = getTimeRemaining(product.saleEndAt, translations);
          const showBuyButton =
            product.affiliateUrl && !(hideFanzaPurchaseLinks && product.aspName?.toLowerCase() === 'fanza');
          return (
            <div
              key={product['id']}
              className={`group overflow-hidden rounded-lg transition-all ${
                isDark ? 'bg-gray-800/50 hover:bg-gray-800' : 'bg-white hover:shadow-md'
              }`}
            >
              <Link href={`/${locale}/products/${product['id']}`} className="block">
                {/* サムネイル */}
                <div className="relative aspect-video">
                  <Image
                    src={normalizeImageUrl(product.imageUrl)}
                    alt={product['title']}
                    fill
                    className="object-cover transition-transform group-hover:scale-105"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    loading="lazy"
                  />
                  {/* 割引率バッジ */}
                  {product.discountPercent > 0 && (
                    <div className="absolute top-2 left-2 rounded bg-red-500 px-2 py-1 text-sm font-bold text-white">
                      {product.discountPercent}% {translations.off}
                    </div>
                  )}
                  {/* 残り時間バッジ */}
                  <div
                    className={`absolute right-2 bottom-2 rounded px-2 py-1 text-xs ${
                      timeRemaining.isUrgent
                        ? 'animate-pulse bg-red-500 text-white'
                        : isDark
                          ? 'bg-black/70 text-gray-200'
                          : 'bg-white/90 text-gray-700'
                    }`}
                  >
                    {timeRemaining.text}
                  </div>
                </div>

                {/* 情報 */}
                <div className="p-3">
                  <h3
                    className={`line-clamp-2 text-sm font-medium transition-colors ${
                      isDark ? 'text-white group-hover:text-red-400' : 'text-gray-900 group-hover:text-red-600'
                    }`}
                  >
                    {product['title']}
                  </h3>

                  {/* 価格 */}
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className={`text-lg font-bold ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                      {translations.yen}
                      {product.salePrice.toLocaleString()}
                    </span>
                    {product['originalPrice'] && (
                      <span className={`text-sm line-through ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        {translations.yen}
                        {product['originalPrice'].toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
              {/* 購入ボタン（Link外に配置 - nested <a>回避） */}
              {showBuyButton && (
                <div className="px-3 pb-3">
                  <a
                    href={product.affiliateUrl!}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                    className={`block w-full rounded-md py-1.5 text-center text-xs font-bold text-white transition-opacity hover:opacity-90 ${
                      isDark ? 'bg-linear-to-r from-orange-500 to-red-500' : 'bg-linear-to-r from-pink-500 to-rose-500'
                    }`}
                  >
                    {translations.buyNow || '購入'} &rarr;
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
