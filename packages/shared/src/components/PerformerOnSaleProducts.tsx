'use client';

import Link from 'next/link';
import Image from 'next/image';
import { normalizeImageUrl } from '../lib/image-utils';

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
  };
}

const PLACEHOLDER_IMAGE = 'https://placehold.co/300x200/1f2937/ffffff?text=No+Image';

// 残り時間を計算
function getTimeRemaining(endDate: string, translations: PerformerOnSaleProductsProps['translations']): { text: string; isUrgent: boolean } {
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
  theme = 'dark',
  translations,
}: PerformerOnSaleProductsProps) {
  if (products.length === 0) {
    return null;
  }

  const isDark = theme === 'dark';

  return (
    <div className={`mt-8 rounded-lg p-6 ${isDark ? 'bg-linear-to-br from-red-900/30 to-pink-900/30' : 'bg-linear-to-br from-red-50 to-pink-50'}`}>
      <h2 className={`text-xl font-bold mb-2 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
        <svg className={`w-6 h-6 ${isDark ? 'text-red-400' : 'text-red-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {translations.title.replace('{name}', performerName)}
      </h2>
      <p className={`text-sm mb-4 ${isDark ? 'text-red-300' : 'text-red-700'}`}>
        {translations.description}
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {products.map((product) => {
          const timeRemaining = getTimeRemaining(product.saleEndAt, translations);
          return (
            <Link
              key={product['id']}
              href={`/${locale}/products/${product['id']}`}
              className={`group block rounded-lg overflow-hidden transition-all ${
                isDark
                  ? 'bg-gray-800/50 hover:bg-gray-800'
                  : 'bg-white hover:shadow-md'
              }`}
            >
              {/* サムネイル */}
              <div className="relative aspect-video">
                <Image
                  src={normalizeImageUrl(product.imageUrl)}
                  alt={product['title']}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  loading="lazy"
                />
                {/* 割引率バッジ */}
                {product.discountPercent > 0 && (
                  <div className="absolute top-2 left-2 bg-red-500 text-white text-sm font-bold px-2 py-1 rounded">
                    {product.discountPercent}% {translations.off}
                  </div>
                )}
                {/* 残り時間バッジ */}
                <div className={`absolute bottom-2 right-2 text-xs px-2 py-1 rounded ${
                  timeRemaining.isUrgent
                    ? 'bg-red-500 text-white animate-pulse'
                    : isDark ? 'bg-black/70 text-gray-200' : 'bg-white/90 text-gray-700'
                }`}>
                  {timeRemaining.text}
                </div>
              </div>

              {/* 情報 */}
              <div className="p-3">
                <h3 className={`text-sm font-medium line-clamp-2 transition-colors ${
                  isDark ? 'text-white group-hover:text-red-400' : 'text-gray-900 group-hover:text-red-600'
                }`}>
                  {product['title']}
                </h3>

                {/* 価格 */}
                <div className="mt-2 flex items-baseline gap-2">
                  <span className={`text-lg font-bold ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                    {translations.yen}{product.salePrice.toLocaleString()}
                  </span>
                  {product['originalPrice'] && (
                    <span className={`text-sm line-through ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {translations.yen}{product['originalPrice'].toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
