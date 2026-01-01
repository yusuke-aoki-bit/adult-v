'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface ForYouProduct {
  id: number;
  normalizedProductId: string;
  title: string;
  thumbnailUrl: string | null;
  regularPrice: number;
  salePrice: number;
  discountPercent: number;
  matchReason: 'favorite_actress' | 'recently_viewed' | 'genre_match' | 'trending';
  matchDetails?: string;
  performers: Array<{ id: number; name: string }>;
  saleEndAt?: string;
}

interface ForYouSalesProps {
  locale?: string;
  theme?: 'dark' | 'light';
  productLinkPrefix?: string;
  limit?: number;
}

const TRANSLATIONS = {
  ja: {
    forYouSales: 'あなたへのおすすめセール',
    description: '閲覧履歴・お気に入りに基づくセール情報',
    favoriteActress: 'お気に入りの女優',
    recentlyViewed: '最近見た作品に関連',
    genreMatch: '好みのジャンル',
    trending: '人気上昇中',
    endsIn: 'あと',
    viewAll: 'すべて見る',
    noSales: 'セール中の作品はありません',
    loading: '読み込み中...',
    off: 'OFF',
    hours: '時間',
    days: '日',
  },
  en: {
    forYouSales: 'Sales For You',
    description: 'Based on your viewing history and favorites',
    favoriteActress: 'Favorite actress',
    recentlyViewed: 'Related to recent views',
    genreMatch: 'Genre match',
    trending: 'Trending',
    endsIn: 'Ends in',
    viewAll: 'View all',
    noSales: 'No sales available',
    loading: 'Loading...',
    off: 'OFF',
    hours: 'hours',
    days: 'days',
  },
  zh: {
    forYouSales: '为您推荐的促销',
    description: '基于您的浏览历史和收藏',
    favoriteActress: '收藏的女优',
    recentlyViewed: '与最近浏览相关',
    genreMatch: '喜欢的类型',
    trending: '热门上升',
    endsIn: '剩余',
    viewAll: '查看全部',
    noSales: '暂无促销商品',
    loading: '加载中...',
    off: '折扣',
    hours: '小时',
    days: '天',
  },
  ko: {
    forYouSales: '맞춤 세일',
    description: '시청 기록 및 즐겨찾기 기반',
    favoriteActress: '즐겨찾는 배우',
    recentlyViewed: '최근 본 작품과 관련',
    genreMatch: '선호 장르',
    trending: '인기 상승',
    endsIn: '종료까지',
    viewAll: '모두 보기',
    noSales: '세일 상품 없음',
    loading: '로딩 중...',
    off: 'OFF',
    hours: '시간',
    days: '일',
  },
};

const MATCH_REASON_COLORS = {
  favorite_actress: 'bg-pink-500',
  recently_viewed: 'bg-blue-500',
  genre_match: 'bg-purple-500',
  trending: 'bg-orange-500',
};

export default function ForYouSales({
  locale = 'ja',
  theme = 'dark',
  productLinkPrefix = '/products',
  limit = 8,
}: ForYouSalesProps) {
  const [products, setProducts] = useState<ForYouProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const t = TRANSLATIONS[locale as keyof typeof TRANSLATIONS] || TRANSLATIONS.ja;
  const isDark = theme === 'dark';

  useEffect(() => {
    async function fetchForYouSales() {
      try {
        // お気に入り女優IDを取得
        const favoriteActressesRaw = localStorage.getItem(`favoriteActresses-${process.env.NEXT_PUBLIC_SITE_MODE || 'adult-v'}`);
        const favoriteActresses = favoriteActressesRaw ? JSON.parse(favoriteActressesRaw) : [];

        // 最近見た作品IDを取得
        const recentlyViewedRaw = localStorage.getItem(`recentlyViewed-${process.env.NEXT_PUBLIC_SITE_MODE || 'adult-v'}`);
        const recentlyViewed = recentlyViewedRaw ? JSON.parse(recentlyViewedRaw) : [];
        const recentProductIds = recentlyViewed.slice(0, 10).map((item: { productId: string }) => item.productId);

        const params = new URLSearchParams();
        if (favoriteActresses.length > 0) {
          params.set('favoritePerformerIds', favoriteActresses.join(','));
        }
        if (recentProductIds.length > 0) {
          params.set('recentProductIds', recentProductIds.join(','));
        }
        params.set('limit', limit.toString());

        const response = await fetch(`/api/sales/for-you?${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          setProducts(data.products || []);
        }
      } catch (error) {
        console.error('Failed to fetch for-you sales:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchForYouSales();
  }, [limit]);

  const getMatchReasonLabel = (reason: ForYouProduct['matchReason']) => {
    switch (reason) {
      case 'favorite_actress': return t.favoriteActress;
      case 'recently_viewed': return t.recentlyViewed;
      case 'genre_match': return t.genreMatch;
      case 'trending': return t.trending;
      default: return '';
    }
  };

  const formatTimeRemaining = (endAt: string) => {
    const now = new Date();
    const end = new Date(endAt);
    const diff = end.getTime() - now.getTime();
    if (diff <= 0) return null;

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}${t.days}`;
    }
    return `${hours}${t.hours}`;
  };

  if (loading) {
    return (
      <div className={`rounded-lg p-6 ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
        <div className="h-6 bg-gray-700 rounded w-1/4 mb-4 animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-gray-700 rounded-lg animate-pulse" style={{ aspectRatio: '3/4' }} />
          ))}
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return null;
  }

  return (
    <div className={`rounded-lg p-6 ${isDark ? 'bg-gradient-to-br from-rose-900/20 to-orange-900/20 border border-rose-700/30' : 'bg-gradient-to-br from-rose-50 to-orange-50 border border-rose-200'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className={`text-xl font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          <svg className="w-6 h-6 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          {t.forYouSales}
        </h2>
        <Link
          href={`/${locale}/products?onSale=true`}
          className={`text-sm flex items-center gap-1 ${isDark ? 'text-rose-400 hover:text-rose-300' : 'text-rose-600 hover:text-rose-700'}`}
        >
          {t.viewAll}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
        {t.description}
      </p>

      {/* Product Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {products.map((product) => (
          <Link
            key={product.id}
            href={`${productLinkPrefix}/${product.normalizedProductId || product.id}`}
            className={`group rounded-lg overflow-hidden transition-transform hover:scale-[1.02] ${isDark ? 'bg-gray-800/50' : 'bg-white shadow-sm'}`}
          >
            {/* Image */}
            <div className="relative" style={{ aspectRatio: '3/4' }}>
              {product.thumbnailUrl ? (
                <Image
                  src={product.thumbnailUrl}
                  alt={product.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                  loading="lazy"
                />
              ) : (
                <div className={`w-full h-full flex items-center justify-center ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                  <span className="text-xs text-gray-500">No Image</span>
                </div>
              )}

              {/* Discount Badge */}
              <div className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">
                -{product.discountPercent}% {t.off}
              </div>

              {/* Match Reason Badge */}
              <div className={`absolute top-2 right-2 ${MATCH_REASON_COLORS[product.matchReason]} text-white text-[10px] px-1.5 py-0.5 rounded`}>
                {getMatchReasonLabel(product.matchReason)}
              </div>

              {/* Time Remaining */}
              {product.saleEndAt && (
                <div className="absolute bottom-2 left-2 right-2">
                  {formatTimeRemaining(product.saleEndAt) && (
                    <div className={`text-center text-xs py-1 rounded ${isDark ? 'bg-black/70 text-white' : 'bg-white/90 text-gray-900'}`}>
                      {t.endsIn} {formatTimeRemaining(product.saleEndAt)}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="p-2">
              <p className={`text-xs line-clamp-2 mb-1 ${isDark ? 'text-gray-300 group-hover:text-white' : 'text-gray-700 group-hover:text-gray-900'}`}>
                {product.title}
              </p>
              {product.performers.length > 0 && (
                <p className={`text-xs mb-1 truncate ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  {product.performers.map((p) => p.name).join(', ')}
                </p>
              )}
              <div className="flex items-center gap-2">
                <span className={`text-xs line-through ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  ¥{product.regularPrice.toLocaleString()}
                </span>
                <span className="text-sm font-bold text-red-500">
                  ¥{product.salePrice.toLocaleString()}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
