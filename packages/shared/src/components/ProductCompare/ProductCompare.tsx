'use client';

import { useState, useEffect, useCallback } from 'react';

interface CompareProduct {
  id: number;
  normalizedProductId: string;
  title: string;
  imageUrl: string | null;
  releaseDate: string | null;
  duration: number | null;
  performers: string[];
  tags: string[];
  sources: Array<{
    aspName: string;
    price: number | null;
    salePrice: number | null;
    discountPercent: number | null;
    affiliateUrl: string;
  }>;
  rating: {
    average: number | null;
    count: number;
  };
}

interface ComparisonData {
  commonTags: string[];
  commonPerformers: string[];
  priceRange: {
    min: number;
    max: number;
  };
}

interface ProductCompareProps {
  productIds: string[];
  locale?: string;
  theme?: 'light' | 'dark';
  onProductClick?: (productId: string) => void;
  onRemoveProduct?: (productId: string) => void;
}

export function ProductCompare({
  productIds,
  locale = 'ja',
  theme = 'dark',
  onProductClick,
  onRemoveProduct,
}: ProductCompareProps) {
  const [products, setProducts] = useState<CompareProduct[]>([]);
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const themeClasses = {
    container: theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200',
    text: theme === 'dark' ? 'text-white' : 'text-gray-900',
    textMuted: theme === 'dark' ? 'text-gray-400' : 'text-gray-500',
    card: theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100',
    tag: theme === 'dark' ? 'bg-gray-600 text-gray-200' : 'bg-gray-200 text-gray-700',
    highlight: theme === 'dark' ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700',
    rowEven: theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50',
  };

  useEffect(() => {
    if (productIds.length < 2) {
      setProducts([]);
      setComparison(null);
      return;
    }

    const fetchComparison = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/products/compare?ids=${productIds.join(',')}`);
        if (!response.ok) {
          throw new Error('Failed to fetch comparison data');
        }

        const data = await response.json();
        setProducts(data.products || []);
        setComparison(data.comparison || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error loading comparison');
      } finally {
        setIsLoading(false);
      }
    };

    fetchComparison();
  }, [productIds]);

  const formatPrice = (price: number | null) => {
    if (price === null) return '-';
    return `¥${price.toLocaleString()}`;
  };

  const formatDuration = (minutes: number | null) => {
    if (minutes === null) return '-';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}時間${mins}分` : `${mins}分`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString(locale === 'ja' ? 'ja-JP' : 'en-US');
  };

  const getBestPrice = (product: CompareProduct) => {
    const prices = product.sources
      .map(s => s.salePrice || s.price)
      .filter((p): p is number => p !== null);
    return prices.length > 0 ? Math.min(...prices) : null;
  };

  const lowestPrice = products.length > 0
    ? Math.min(...products.map(p => getBestPrice(p) || Infinity))
    : null;

  if (productIds.length < 2) {
    return (
      <div className={`rounded-lg border p-6 text-center ${themeClasses.container}`}>
        <p className={themeClasses.textMuted}>
          {locale === 'ja'
            ? '比較するには2作品以上を選択してください'
            : 'Select at least 2 products to compare'}
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`rounded-lg border p-6 ${themeClasses.container}`}>
        <div className="flex items-center justify-center gap-2">
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className={themeClasses.text}>
            {locale === 'ja' ? '読み込み中...' : 'Loading...'}
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`rounded-lg border p-6 ${themeClasses.container}`}>
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border overflow-hidden ${themeClasses.container}`}>
      {/* 比較テーブル */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className={themeClasses.card}>
              <th className={`p-3 text-left text-sm font-medium ${themeClasses.textMuted} w-32`}>
                {locale === 'ja' ? '項目' : 'Item'}
              </th>
              {products.map((product) => (
                <th key={product.id} className="p-3 text-center">
                  <div className="relative">
                    {onRemoveProduct && (
                      <button
                        onClick={() => onRemoveProduct(product.normalizedProductId)}
                        className="absolute -top-1 -right-1 p-1 bg-red-500 rounded-full text-white hover:bg-red-600 transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                    <div
                      className="cursor-pointer"
                      onClick={() => onProductClick?.(product.normalizedProductId)}
                    >
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.title}
                          className="w-24 h-32 object-cover rounded mx-auto mb-2"
                        />
                      ) : (
                        <div className={`w-24 h-32 rounded mx-auto mb-2 flex items-center justify-center ${themeClasses.card}`}>
                          <svg className={`w-8 h-8 ${themeClasses.textMuted}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                      <p className={`text-xs line-clamp-2 ${themeClasses.text}`}>{product.title}</p>
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* 価格 */}
            <tr className={themeClasses.rowEven}>
              <td className={`p-3 text-sm font-medium ${themeClasses.textMuted}`}>
                {locale === 'ja' ? '価格' : 'Price'}
              </td>
              {products.map((product) => {
                const bestPrice = getBestPrice(product);
                const isLowest = bestPrice !== null && bestPrice === lowestPrice;
                const hasSale = product.sources.some(s => s.salePrice !== null);

                return (
                  <td key={product.id} className="p-3 text-center">
                    <div className={`font-bold ${isLowest ? 'text-green-500' : themeClasses.text}`}>
                      {formatPrice(bestPrice)}
                      {isLowest && (
                        <span className="ml-1 text-xs bg-green-500 text-white px-1 rounded">
                          {locale === 'ja' ? '最安' : 'Best'}
                        </span>
                      )}
                    </div>
                    {hasSale && (
                      <div className="text-xs text-red-400">
                        {locale === 'ja' ? 'セール中' : 'On Sale'}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>

            {/* 再生時間 */}
            <tr>
              <td className={`p-3 text-sm font-medium ${themeClasses.textMuted}`}>
                {locale === 'ja' ? '再生時間' : 'Duration'}
              </td>
              {products.map((product) => (
                <td key={product.id} className={`p-3 text-center text-sm ${themeClasses.text}`}>
                  {formatDuration(product.duration)}
                </td>
              ))}
            </tr>

            {/* 発売日 */}
            <tr className={themeClasses.rowEven}>
              <td className={`p-3 text-sm font-medium ${themeClasses.textMuted}`}>
                {locale === 'ja' ? '発売日' : 'Release Date'}
              </td>
              {products.map((product) => (
                <td key={product.id} className={`p-3 text-center text-sm ${themeClasses.text}`}>
                  {formatDate(product.releaseDate)}
                </td>
              ))}
            </tr>

            {/* 評価 */}
            <tr>
              <td className={`p-3 text-sm font-medium ${themeClasses.textMuted}`}>
                {locale === 'ja' ? '評価' : 'Rating'}
              </td>
              {products.map((product) => (
                <td key={product.id} className={`p-3 text-center text-sm ${themeClasses.text}`}>
                  {product.rating.average !== null ? (
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-yellow-500">★</span>
                      <span>{product.rating.average.toFixed(1)}</span>
                      <span className={`text-xs ${themeClasses.textMuted}`}>
                        ({product.rating.count})
                      </span>
                    </div>
                  ) : (
                    '-'
                  )}
                </td>
              ))}
            </tr>

            {/* 出演者 */}
            <tr className={themeClasses.rowEven}>
              <td className={`p-3 text-sm font-medium ${themeClasses.textMuted}`}>
                {locale === 'ja' ? '出演者' : 'Performers'}
              </td>
              {products.map((product) => (
                <td key={product.id} className="p-3">
                  <div className="flex flex-wrap justify-center gap-1">
                    {product.performers.slice(0, 5).map((performer, i) => (
                      <span
                        key={i}
                        className={`px-2 py-0.5 text-xs rounded ${
                          comparison?.commonPerformers.includes(performer)
                            ? themeClasses.highlight
                            : themeClasses.tag
                        }`}
                      >
                        {performer}
                      </span>
                    ))}
                    {product.performers.length > 5 && (
                      <span className={`text-xs ${themeClasses.textMuted}`}>
                        +{product.performers.length - 5}
                      </span>
                    )}
                  </div>
                </td>
              ))}
            </tr>

            {/* ジャンル */}
            <tr>
              <td className={`p-3 text-sm font-medium ${themeClasses.textMuted}`}>
                {locale === 'ja' ? 'ジャンル' : 'Genres'}
              </td>
              {products.map((product) => (
                <td key={product.id} className="p-3">
                  <div className="flex flex-wrap justify-center gap-1">
                    {product.tags.slice(0, 6).map((tag, i) => (
                      <span
                        key={i}
                        className={`px-2 py-0.5 text-xs rounded ${
                          comparison?.commonTags.includes(tag)
                            ? themeClasses.highlight
                            : themeClasses.tag
                        }`}
                      >
                        {tag}
                      </span>
                    ))}
                    {product.tags.length > 6 && (
                      <span className={`text-xs ${themeClasses.textMuted}`}>
                        +{product.tags.length - 6}
                      </span>
                    )}
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* 共通点サマリー */}
      {comparison && (comparison.commonTags.length > 0 || comparison.commonPerformers.length > 0) && (
        <div className={`p-4 border-t ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
          <h3 className={`text-sm font-semibold mb-2 ${themeClasses.text}`}>
            {locale === 'ja' ? '共通点' : 'Common Features'}
          </h3>
          <div className="flex flex-wrap gap-2">
            {comparison.commonPerformers.map((performer, i) => (
              <span key={`p-${i}`} className={`px-2 py-1 text-xs rounded ${themeClasses.highlight}`}>
                👤 {performer}
              </span>
            ))}
            {comparison.commonTags.map((tag, i) => (
              <span key={`t-${i}`} className={`px-2 py-1 text-xs rounded ${themeClasses.highlight}`}>
                🏷️ {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
