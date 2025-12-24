'use client';

import Link from 'next/link';
import Image from 'next/image';

interface TopRatedProduct {
  id: number;
  title: string;
  normalizedProductId: string | null;
  imageUrl: string | null;
  releaseDate: string | null;
  rating: number | null;
  reviewCount: number;
  viewCount: number;
  rank: number;
  salePrice: number | null;
  saleEndAt: string | null;
}

interface PerformerTopProductsProps {
  products: TopRatedProduct[];
  performerName: string;
  locale: string;
  theme?: 'dark' | 'light';
  translations: {
    title: string;
    description: string;
    rating: string;
    reviews: string;
    views: string;
    onSale: string;
  };
}

const PLACEHOLDER_IMAGE = 'https://placehold.co/300x200/1f2937/ffffff?text=No+Image';

// ランキングの色を返す
function getRankStyle(rank: number, theme: 'dark' | 'light'): { bg: string; text: string; border: string } {
  const isDark = theme === 'dark';
  switch (rank) {
    case 1:
      return {
        bg: 'bg-gradient-to-br from-yellow-400 to-yellow-600',
        text: 'text-black font-bold',
        border: isDark ? 'ring-yellow-400' : 'ring-yellow-500',
      };
    case 2:
      return {
        bg: 'bg-gradient-to-br from-gray-300 to-gray-500',
        text: 'text-black font-bold',
        border: isDark ? 'ring-gray-400' : 'ring-gray-500',
      };
    case 3:
      return {
        bg: 'bg-gradient-to-br from-amber-600 to-amber-800',
        text: 'text-white font-bold',
        border: isDark ? 'ring-amber-600' : 'ring-amber-700',
      };
    default:
      return {
        bg: isDark ? 'bg-gray-700' : 'bg-gray-200',
        text: isDark ? 'text-white' : 'text-gray-900',
        border: 'ring-transparent',
      };
  }
}

export default function PerformerTopProducts({
  products,
  performerName,
  locale,
  theme = 'dark',
  translations,
}: PerformerTopProductsProps) {
  if (products.length === 0) {
    return null;
  }

  const isDark = theme === 'dark';

  return (
    <div className={`mt-8 rounded-lg p-6 ${isDark ? 'bg-gradient-to-br from-amber-900/30 to-orange-900/30' : 'bg-gradient-to-br from-amber-50 to-orange-50'}`}>
      <h2 className={`text-xl font-bold mb-2 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
        <svg className={`w-6 h-6 ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`} fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
        {translations.title.replace('{name}', performerName)}
      </h2>
      <p className={`text-sm mb-4 ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
        {translations.description}
      </p>

      <div className="space-y-3">
        {products.map((product) => {
          const rankStyle = getRankStyle(product.rank, theme);
          return (
            <Link
              key={product.id}
              href={`/${locale}/products/${product.id}`}
              className={`group flex gap-4 p-3 rounded-lg transition-all ${
                isDark
                  ? 'bg-gray-800/50 hover:bg-gray-800'
                  : 'bg-white hover:bg-gray-50 shadow-sm'
              }`}
            >
              {/* ランキングバッジ */}
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${rankStyle.bg} ${rankStyle.text}`}>
                {product.rank}
              </div>

              {/* サムネイル */}
              <div className={`relative flex-shrink-0 w-24 h-16 rounded overflow-hidden ring-2 ${rankStyle.border}`}>
                <Image
                  src={product.imageUrl || PLACEHOLDER_IMAGE}
                  alt={product.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform"
                  sizes="96px"
                  loading="lazy"
                />
                {/* セール中バッジ */}
                {product.salePrice && product.saleEndAt && (
                  <div className="absolute top-0 right-0 bg-red-500 text-white text-[9px] px-1 py-0.5 rounded-bl font-bold">
                    {translations.onSale}
                  </div>
                )}
              </div>

              {/* 情報 */}
              <div className="flex-1 min-w-0">
                <h3 className={`text-sm font-medium line-clamp-1 transition-colors ${
                  isDark ? 'text-white group-hover:text-yellow-400' : 'text-gray-900 group-hover:text-amber-600'
                }`}>
                  {product.title}
                </h3>

                <div className={`flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {/* 評価 */}
                  {product.rating && product.rating > 0 && (
                    <span className="flex items-center gap-1">
                      <svg className={`w-3.5 h-3.5 ${isDark ? 'text-yellow-400' : 'text-yellow-500'}`} fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      <span className={isDark ? 'text-yellow-400' : 'text-yellow-600'}>{product.rating.toFixed(1)}</span>
                    </span>
                  )}

                  {/* レビュー数 */}
                  {product.reviewCount > 0 && (
                    <span>
                      {product.reviewCount} {translations.reviews}
                    </span>
                  )}

                  {/* 閲覧数 */}
                  {product.viewCount > 0 && (
                    <span>
                      {product.viewCount.toLocaleString()} {translations.views}
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
