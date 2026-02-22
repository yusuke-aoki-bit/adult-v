'use client';

import { useState, useEffect, useRef } from 'react';
import { useSiteTheme } from '../../contexts/SiteThemeContext';

interface AlsoViewedProduct {
  id: number;
  title: string;
  normalizedProductId: string | null;
  imageUrl: string | null;
  coViewRate: number;
  viewCount: number;
}

interface AlsoViewedProps {
  productId: string | number;
  locale?: string;
  theme?: 'light' | 'dark';
  apiEndpoint?: string;
  onProductClick?: (productId: string) => void;
  limit?: number;
  className?: string;
}

const translations = {
  ja: {
    title: 'この作品を見た人は',
    alsoViewed: 'こちらも見ています',
    viewedBy: 'の人が閲覧',
    loading: '読み込み中...',
    error: '取得に失敗しました',
    noData: 'データがありません',
  },
  en: {
    title: 'People who viewed this',
    alsoViewed: 'also viewed',
    viewedBy: 'of viewers',
    loading: 'Loading...',
    error: 'Failed to load',
    noData: 'No data available',
  },
};

export function AlsoViewed({
  productId,
  locale = 'ja',
  theme: themeProp,
  apiEndpoint = '/api/products',
  onProductClick,
  limit = 6,
  className = '',
}: AlsoViewedProps) {
  const { theme: contextTheme } = useSiteTheme();
  const theme = themeProp ?? contextTheme;
  const [products, setProducts] = useState<AlsoViewedProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const t = translations[locale as keyof typeof translations] || translations.ja;
  const isDark = theme === 'dark';

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    async function fetchAlsoViewed() {
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${apiEndpoint}/${productId}/also-viewed?limit=${limit}`,
          { signal: abortControllerRef.current.signal }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch');
        }

        const data = await response.json();

        if (data.success && data.alsoViewed) {
          setProducts(data.alsoViewed);
        } else {
          setProducts([]);
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        console.error('[AlsoViewed] Error:', err);
        setError(t.error);
      } finally {
        setIsLoading(false);
      }
    }

    if (productId) {
      fetchAlsoViewed();
    }

    return () => { abortControllerRef.current?.abort(); };
  }, [productId, apiEndpoint, limit, t.error]);

  const handleProductClick = (product: AlsoViewedProduct) => {
    if (onProductClick) {
      onProductClick(String(product['id']));
    }
  };

  // ローディング中
  if (isLoading) {
    return (
      <div className={`rounded-xl p-4 sm:p-6 ${isDark ? 'bg-gray-800/50' : 'bg-gray-100'} ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl animate-pulse">👥</span>
          <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {t.loading}
          </h3>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className={`aspect-3/4 rounded-lg animate-pulse ${isDark ? 'bg-gray-700' : 'bg-gray-300'}`} />
          ))}
        </div>
      </div>
    );
  }

  // エラー or データなし
  if (error || products.length === 0) {
    return null; // 静かに非表示
  }

  return (
    <div className={`rounded-xl p-4 sm:p-6 ${isDark ? 'bg-gray-800/50' : 'bg-gray-100'} ${className}`}>
      {/* ヘッダー */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">👥</span>
        <div>
          <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {t.title}
          </h3>
          <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {t.alsoViewed}
          </p>
        </div>
      </div>

      {/* 作品グリッド */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {products.map((product) => (
          <div
            key={product['id']}
            onClick={() => handleProductClick(product)}
            className={`group cursor-pointer rounded-lg overflow-hidden transition-transform hover:scale-[1.02] ${
              isDark ? 'bg-gray-900' : 'bg-white'
            }`}
          >
            {/* サムネイル */}
            <div className="relative aspect-3/4 overflow-hidden">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product['title']}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
              ) : (
                <div className={`w-full h-full flex items-center justify-center ${
                  isDark ? 'bg-gray-800' : 'bg-gray-200'
                }`}>
                  <span className="text-2xl opacity-30">🎬</span>
                </div>
              )}

              {/* 閲覧率バッジ */}
              {product.coViewRate > 0 && (
                <div className="absolute top-1 right-1">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    isDark ? 'bg-blue-900/80 text-blue-200' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {product.coViewRate}%
                  </span>
                </div>
              )}
            </div>

            {/* タイトル */}
            <div className="p-1.5">
              <h4 className={`text-[10px] sm:text-xs font-medium line-clamp-2 ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
                {product['title']}
              </h4>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
