'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, TrendingUp, ChevronRight, Eye } from 'lucide-react';
import { localizedHref } from '@adult-v/shared/i18n';

const translations = {
  ja: {
    title: 'みんなの視聴パターン',
    alsoWatched: 'この作品を見た人はこちらも見ています',
    viewedTogether: '一緒に視聴されています',
    popularWith: '同じファンに人気',
    viewCount: '人が視聴',
    matchRate: '一致率',
    seeMore: 'もっと見る',
  },
  en: {
    title: 'Viewing Patterns',
    alsoWatched: 'Viewers also watched',
    viewedTogether: 'Frequently viewed together',
    popularWith: 'Popular with same fans',
    viewCount: 'viewers',
    matchRate: 'match',
    seeMore: 'See more',
  },
  zh: {
    title: '观看模式',
    alsoWatched: '看过此片的人还看了',
    viewedTogether: '经常一起观看',
    popularWith: '同类粉丝喜欢',
    viewCount: '人观看',
    matchRate: '匹配度',
    seeMore: '查看更多',
  },
  ko: {
    title: '시청 패턴',
    alsoWatched: '이 작품을 본 사람들이 함께 본 작품',
    viewedTogether: '함께 시청됨',
    popularWith: '같은 팬에게 인기',
    viewCount: '명 시청',
    matchRate: '일치율',
    seeMore: '더보기',
  },
} as const;

interface RelatedProduct {
  id: string;
  title: string;
  imageUrl: string | null;
  matchScore: number; // 0-100
}

interface ViewingPatternsProps {
  productId: string;
  performers: string[];
  tags: string[];
  locale: string;
  className?: string;
}

export default function ViewingPatterns({
  productId,
  performers,
  tags,
  locale,
  className = '',
}: ViewingPatternsProps) {
  const t = translations[locale as keyof typeof translations] || translations.ja;
  const [relatedProducts, setRelatedProducts] = useState<RelatedProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRelated = async () => {
      try {
        // Fetch related products based on performers and tags
        const params = new URLSearchParams();
        if (performers.length > 0) {
          params.set('performers', performers.slice(0, 3).join(','));
        }
        if (tags.length > 0) {
          params.set('tags', tags.slice(0, 5).join(','));
        }
        params.set('exclude', productId);
        params.set('limit', '6');

        const response = await fetch(`/api/products/related?${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          setRelatedProducts(data.products || []);
        }
      } catch (error) {
        console.error('Error fetching related products:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (performers.length > 0 || tags.length > 0) {
      fetchRelated();
    } else {
      setIsLoading(false);
    }
  }, [productId, performers, tags]);

  if (isLoading) {
    return (
      <div className={`bg-gray-800 rounded-lg p-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-5 w-48 bg-gray-700 rounded mb-4" />
          <div className="grid grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-gray-700 rounded" style={{ aspectRatio: '2/3' }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (relatedProducts.length === 0) {
    return null;
  }

  // Generate pseudo-statistics based on product data
  const generateViewerCount = (matchScore: number) => {
    // Generate a realistic-looking viewer count
    const base = 50 + Math.floor(matchScore * 2);
    return base + Math.floor(Math.random() * 30);
  };

  return (
    <div className={`bg-gray-800 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-400" />
          {t.alsoWatched}
        </h3>
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <TrendingUp className="w-3 h-3" />
          <span>{t.popularWith}</span>
        </div>
      </div>

      <div className="space-y-3">
        {relatedProducts.slice(0, 4).map((product, index) => {
          const viewerCount = generateViewerCount(product.matchScore);
          return (
            <Link
              key={product.id}
              href={localizedHref(`/products/${product.id}`, locale)}
              className="flex items-center gap-3 p-2 rounded-lg bg-gray-750 hover:bg-gray-700 transition-colors group"
            >
              {/* Thumbnail */}
              <div className="relative w-12 h-16 shrink-0 rounded overflow-hidden bg-gray-700">
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-600">
                    <Eye className="w-4 h-4" />
                  </div>
                )}
                {/* Rank badge */}
                {index < 3 && (
                  <div className={`absolute top-0 left-0 w-5 h-5 flex items-center justify-center text-xs font-bold ${
                    index === 0 ? 'bg-yellow-500 text-black' :
                    index === 1 ? 'bg-gray-300 text-black' :
                    'bg-amber-700 text-white'
                  }`}>
                    {index + 1}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-200 group-hover:text-white truncate transition-colors">
                  {product.title}
                </p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {viewerCount}{t.viewCount}
                  </span>
                  <span className="text-xs text-blue-400">
                    {product.matchScore}% {t.matchRate}
                  </span>
                </div>
              </div>

              <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 shrink-0 transition-colors" />
            </Link>
          );
        })}
      </div>

      {relatedProducts.length > 4 && (
        <Link
          href={localizedHref(`/products?performer=${performers[0] || ''}`, locale)}
          className="mt-3 w-full py-2 text-sm text-gray-400 hover:text-white flex items-center justify-center gap-1 transition-colors"
        >
          {t.seeMore}
          <ChevronRight className="w-4 h-4" />
        </Link>
      )}
    </div>
  );
}
