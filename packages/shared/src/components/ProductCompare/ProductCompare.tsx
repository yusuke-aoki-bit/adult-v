'use client';

import { useState, useEffect, useRef, useMemo } from 'react';

// レーダーチャート用ヘルパー関数
function getRadarPoints(cx: number, cy: number, r: number, sides: number): string {
  const points: string[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (Math.PI * 2 * i) / sides - Math.PI / 2;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    points.push(`${x},${y}`);
  }
  return points.join(' ');
}

function getRadarDataPoints(cx: number, cy: number, values: number[]): string {
  const points: string[] = [];
  for (let i = 0; i < values.length; i++) {
    const angle = (Math.PI * 2 * i) / values.length - Math.PI / 2;
    const r = values[i] ?? 0;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    points.push(`${x},${y}`);
  }
  return points.join(' ');
}

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
  // 追加項目
  maker?: string | null;
  series?: string | null;
  hasSampleVideo?: boolean;
  hasSampleImages?: boolean;
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
  const lastFetchedIdsRef = useRef<string>('');
  const isInitialLoadRef = useRef(true);
  const productsRef = useRef<CompareProduct[]>([]);

  // productsRefを最新に保つ
  productsRef.current = products;

  const isDark = theme === 'dark';

  // productIdsを文字列化して比較（配列の参照変更による再実行を防ぐ）
  const idsKey = useMemo(() => [...productIds].sort().join(','), [productIds]);

  useEffect(() => {
    if (productIds.length < 2) {
      setProducts([]);
      setComparison(null);
      lastFetchedIdsRef.current = '';
      return;
    }

    // 同じIDセットなら再フェッチしない
    if (lastFetchedIdsRef.current === idsKey) {
      return;
    }

    // 削除の場合（現在のIDが全て既存データに含まれている）は再フェッチせずフィルタリング
    const currentProducts = productsRef.current;
    const currentProductIds = new Set(currentProducts.map(p => p.normalizedProductId));
    const allIdsExist = productIds.every(id => currentProductIds.has(id));

    if (allIdsExist && currentProducts.length > 0) {
      // 削除されたアイテムを除外
      const filteredProducts = currentProducts.filter(p => productIds.includes(p.normalizedProductId));
      setProducts(filteredProducts);
      lastFetchedIdsRef.current = idsKey;
      return;
    }

    const fetchComparison = async () => {
      // 初回ロードのみローディング表示（既存データがあれば保持）
      if (isInitialLoadRef.current || productsRef.current.length === 0) {
        setIsLoading(true);
      }
      setError(null);

      try {
        const response = await fetch(`/api/products/compare?ids=${productIds.join(',')}`);
        if (!response.ok) {
          throw new Error('Failed to fetch comparison data');
        }

        const data = await response.json();
        setProducts(data.products || []);
        setComparison(data.comparison || null);
        lastFetchedIdsRef.current = idsKey;
        isInitialLoadRef.current = false;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error loading comparison');
      } finally {
        setIsLoading(false);
      }
    };

    fetchComparison();
  }, [idsKey, productIds]);

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

  const getMaxDuration = () => {
    const durations = products.map(p => p.duration).filter((d): d is number => d !== null);
    return durations.length > 0 ? Math.max(...durations) : 0;
  };

  const getMaxRating = () => {
    const ratings = products.map(p => p.rating.average).filter((r): r is number => r !== null);
    return ratings.length > 0 ? Math.max(...ratings) : 0;
  };

  const lowestPrice = products.length > 0
    ? Math.min(...products.map(p => getBestPrice(p) || Infinity))
    : null;

  const maxDuration = getMaxDuration();
  const maxRating = getMaxRating();

  // 空の状態
  if (productIds.length < 2) {
    return (
      <div className={`rounded-2xl border-2 border-dashed p-12 text-center ${
        isDark ? 'border-gray-600 bg-gray-800/50' : 'border-gray-300 bg-gray-50'
      }`}>
        <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
          isDark ? 'bg-gray-700' : 'bg-gray-200'
        }`}>
          <svg className={`w-8 h-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <p className={`text-lg font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
          {locale === 'ja' ? '作品を比較しましょう' : 'Compare Products'}
        </p>
        <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          {locale === 'ja'
            ? '2作品以上を選択すると比較できます'
            : 'Select at least 2 products to compare'}
        </p>
      </div>
    );
  }

  // ローディング
  if (isLoading) {
    return (
      <div className={`rounded-2xl border p-8 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="relative w-12 h-12">
            <div className={`absolute inset-0 rounded-full border-4 border-t-transparent animate-spin ${
              isDark ? 'border-blue-500' : 'border-blue-600'
            }`} />
          </div>
          <p className={isDark ? 'text-gray-300' : 'text-gray-600'}>
            {locale === 'ja' ? '比較データを読み込み中...' : 'Loading comparison...'}
          </p>
        </div>
      </div>
    );
  }

  // エラー
  if (error) {
    return (
      <div className={`rounded-2xl border p-8 ${isDark ? 'bg-red-900/20 border-red-800' : 'bg-red-50 border-red-200'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            isDark ? 'bg-red-800' : 'bg-red-100'
          }`}>
            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className={isDark ? 'text-red-400' : 'text-red-600'}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 作品カード */}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${products.length}, 1fr)` }}>
        {products.map((product) => {
          const bestPrice = getBestPrice(product);
          const isLowestPrice = bestPrice !== null && bestPrice === lowestPrice;
          const hasSale = product.sources.some(s => s.salePrice !== null);
          const isLongest = product['duration'] === maxDuration && maxDuration > 0;
          const isHighestRated = product['rating'].average === maxRating && maxRating > 0;

          return (
            <div
              key={product['id']}
              className={`relative rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02] ${
                isDark
                  ? 'bg-gradient-to-b from-gray-800 to-gray-900 border border-gray-700 hover:border-gray-600'
                  : 'bg-white border border-gray-200 hover:border-gray-300 shadow-sm hover:shadow-md'
              }`}
            >
              {/* 削除ボタン */}
              {onRemoveProduct && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onRemoveProduct(product.normalizedProductId);
                  }}
                  className={`absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    isDark
                      ? 'bg-gray-900/80 hover:bg-red-600 text-gray-400 hover:text-white'
                      : 'bg-white/90 hover:bg-red-500 text-gray-500 hover:text-white shadow-sm'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}

              {/* バッジ */}
              <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5">
                {isLowestPrice && (
                  <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg">
                    {locale === 'ja' ? '最安値' : 'Best Price'}
                  </span>
                )}
                {hasSale && !isLowestPrice && (
                  <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-lg">
                    {locale === 'ja' ? 'セール中' : 'On Sale'}
                  </span>
                )}
                {isHighestRated && (
                  <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-lg">
                    {locale === 'ja' ? '高評価' : 'Top Rated'}
                  </span>
                )}
                {isLongest && (
                  <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-lg">
                    {locale === 'ja' ? '長尺' : 'Longest'}
                  </span>
                )}
              </div>

              {/* 画像 */}
              <div
                className="cursor-pointer aspect-square relative overflow-hidden"
                onClick={() => onProductClick?.(product.normalizedProductId)}
              >
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product['title']}
                    className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                  />
                ) : (
                  <div className={`w-full h-full flex items-center justify-center ${
                    isDark ? 'bg-gray-700' : 'bg-gray-100'
                  }`}>
                    <svg className={`w-16 h-16 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
                {/* グラデーションオーバーレイ */}
                <div className={`absolute inset-0 bg-gradient-to-t ${
                  isDark ? 'from-gray-900 via-transparent' : 'from-black/30 via-transparent'
                }`} />
                {/* サンプル動画・画像バッジ */}
                <div className="absolute bottom-2 left-2 flex gap-1">
                  {product.hasSampleVideo && (
                    <span className={`px-2 py-0.5 text-xs rounded flex items-center gap-1 ${
                      isDark ? 'bg-gray-900/80 text-white' : 'bg-white/90 text-gray-800'
                    }`}>
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                      {locale === 'ja' ? '動画' : 'Video'}
                    </span>
                  )}
                  {product.hasSampleImages && (
                    <span className={`px-2 py-0.5 text-xs rounded flex items-center gap-1 ${
                      isDark ? 'bg-gray-900/80 text-white' : 'bg-white/90 text-gray-800'
                    }`}>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {locale === 'ja' ? '画像' : 'Images'}
                    </span>
                  )}
                </div>
              </div>

              {/* 情報 */}
              <div className="p-4 space-y-4">
                {/* タイトル */}
                <h3
                  className={`font-semibold text-sm line-clamp-2 cursor-pointer hover:underline ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}
                  onClick={() => onProductClick?.(product.normalizedProductId)}
                >
                  {product['title']}
                </h3>

                {/* 価格 */}
                <div className={`p-3 rounded-xl ${
                  isDark ? 'bg-gray-800' : 'bg-gray-50'
                }`}>
                  <div className={`text-xs mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    {locale === 'ja' ? '価格' : 'Price'}
                  </div>
                  <div className={`text-2xl font-bold ${
                    isLowestPrice ? 'text-green-500' : isDark ? 'text-white' : 'text-gray-900'
                  }`}>
                    {formatPrice(bestPrice)}
                  </div>
                </div>

                {/* スペック */}
                <div className="grid grid-cols-2 gap-2">
                  <div className={`p-2.5 rounded-lg text-center ${
                    isDark ? 'bg-gray-800' : 'bg-gray-50'
                  }`}>
                    <div className={`text-xs mb-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {locale === 'ja' ? '再生時間' : 'Duration'}
                    </div>
                    <div className={`text-sm font-semibold ${
                      isLongest ? 'text-purple-500' : isDark ? 'text-white' : 'text-gray-900'
                    }`}>
                      {formatDuration(product['duration'])}
                    </div>
                  </div>
                  <div className={`p-2.5 rounded-lg text-center ${
                    isDark ? 'bg-gray-800' : 'bg-gray-50'
                  }`}>
                    <div className={`text-xs mb-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {locale === 'ja' ? '評価' : 'Rating'}
                    </div>
                    <div className={`text-sm font-semibold flex items-center justify-center gap-1 ${
                      isHighestRated ? 'text-yellow-500' : isDark ? 'text-white' : 'text-gray-900'
                    }`}>
                      {product['rating'].average !== null ? (
                        <>
                          <span className="text-yellow-500">★</span>
                          {product['rating'].average.toFixed(1)}
                        </>
                      ) : '-'}
                    </div>
                  </div>
                </div>

                {/* 追加情報 */}
                <div className="grid grid-cols-2 gap-2">
                  {/* 発売日 */}
                  <div className={`p-2.5 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
                    <div className={`text-xs mb-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {locale === 'ja' ? '発売日' : 'Release'}
                    </div>
                    <div className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {formatDate(product['releaseDate'])}
                    </div>
                  </div>
                  {/* レビュー件数 */}
                  <div className={`p-2.5 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
                    <div className={`text-xs mb-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {locale === 'ja' ? 'レビュー' : 'Reviews'}
                    </div>
                    <div className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {product['rating'].count > 0 ? `${product['rating'].count}件` : '-'}
                    </div>
                  </div>
                </div>

                {/* メーカー・シリーズ */}
                {(product.maker || product.series) && (
                  <div className="space-y-2">
                    {product.maker && (
                      <div className={`text-xs flex items-center gap-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        <span className="truncate">{product.maker}</span>
                      </div>
                    )}
                    {product.series && (
                      <div className={`text-xs flex items-center gap-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        <span className="truncate">{product.series}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* 出演者 */}
                {product.performers.length > 0 && (
                  <div>
                    <div className={`text-xs mb-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {locale === 'ja' ? '出演者' : 'Performers'}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {product.performers.slice(0, 4).map((performer, i) => (
                        <span
                          key={i}
                          className={`px-2 py-1 text-xs rounded-full ${
                            comparison?.commonPerformers.includes(performer)
                              ? isDark
                                ? 'bg-green-900/50 text-green-400 border border-green-700'
                                : 'bg-green-100 text-green-700 border border-green-200'
                              : isDark
                                ? 'bg-gray-700 text-gray-300'
                                : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {performer}
                        </span>
                      ))}
                      {product.performers.length > 4 && (
                        <span className={`px-2 py-1 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                          +{product.performers.length - 4}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* ジャンル */}
                {product.tags.length > 0 && (
                  <div>
                    <div className={`text-xs mb-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {locale === 'ja' ? 'ジャンル' : 'Genres'}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {product.tags.slice(0, 5).map((tag, i) => (
                        <span
                          key={i}
                          className={`px-2 py-1 text-xs rounded-full ${
                            comparison?.commonTags.includes(tag)
                              ? isDark
                                ? 'bg-blue-900/50 text-blue-400 border border-blue-700'
                                : 'bg-blue-100 text-blue-700 border border-blue-200'
                              : isDark
                                ? 'bg-gray-700 text-gray-300'
                                : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {tag}
                        </span>
                      ))}
                      {product.tags.length > 5 && (
                        <span className={`px-2 py-1 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                          +{product.tags.length - 5}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* 配信サイト */}
                {product.sources.length > 0 && (
                  <div className={`pt-3 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                    <div className={`text-xs mb-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {locale === 'ja' ? '配信サイト' : 'Available on'}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {product.sources.map((source, i) => (
                        <a
                          key={i}
                          href={source.affiliateUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`px-2.5 py-1.5 text-xs rounded-lg flex items-center gap-1.5 transition-colors ${
                            isDark
                              ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {source.aspName}
                          {source.salePrice && (
                            <span className="text-red-500 font-semibold">
                              -{source.discountPercent}%
                            </span>
                          )}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 比較グラフセクション */}
      {products.length >= 2 && (
        <div className={`rounded-2xl p-5 ${
          isDark
            ? 'bg-gradient-to-r from-gray-800 to-gray-900 border border-gray-700'
            : 'bg-gradient-to-r from-gray-50 to-white border border-gray-200'
        }`}>
          <h3 className={`text-sm font-semibold mb-4 flex items-center gap-2 ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}>
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            {locale === 'ja' ? '比較グラフ' : 'Comparison Chart'}
          </h3>

          <div className="flex flex-col lg:flex-row gap-6">
            {/* レーダーチャート */}
            <div className="flex-1">
              <p className={`text-xs mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {locale === 'ja' ? 'レーダーチャート' : 'Radar Chart'}
              </p>
              <div className="relative aspect-square max-w-[300px] mx-auto">
                <svg viewBox="0 0 200 200" className="w-full h-full">
                  {/* 背景グリッド（4軸） */}
                  {[100, 75, 50, 25].map((r) => (
                    <polygon
                      key={r}
                      points={getRadarPoints(100, 100, r * 0.8, 4)}
                      fill="none"
                      stroke={isDark ? '#374151' : '#e5e7eb'}
                      strokeWidth="1"
                    />
                  ))}
                  {/* 軸線 */}
                  {[0, 1, 2, 3].map((i) => {
                    const angle = (Math.PI * 2 * i) / 4 - Math.PI / 2;
                    const x = 100 + Math.cos(angle) * 80;
                    const y = 100 + Math.sin(angle) * 80;
                    return (
                      <line
                        key={i}
                        x1="100"
                        y1="100"
                        x2={x}
                        y2={y}
                        stroke={isDark ? '#374151' : '#e5e7eb'}
                        strokeWidth="1"
                      />
                    );
                  })}
                  {/* ラベル */}
                  <text x="100" y="10" textAnchor="middle" className={`text-[9px] ${isDark ? 'fill-gray-400' : 'fill-gray-500'}`}>
                    {locale === 'ja' ? '価格' : 'Price'}
                  </text>
                  <text x="190" y="105" textAnchor="middle" className={`text-[9px] ${isDark ? 'fill-gray-400' : 'fill-gray-500'}`}>
                    {locale === 'ja' ? '時間' : 'Duration'}
                  </text>
                  <text x="100" y="195" textAnchor="middle" className={`text-[9px] ${isDark ? 'fill-gray-400' : 'fill-gray-500'}`}>
                    {locale === 'ja' ? '評価' : 'Rating'}
                  </text>
                  <text x="10" y="105" textAnchor="middle" className={`text-[9px] ${isDark ? 'fill-gray-400' : 'fill-gray-500'}`}>
                    {locale === 'ja' ? 'レビュー' : 'Reviews'}
                  </text>
                  {/* 各作品のデータ */}
                  {products.map((product, idx) => {
                    const colors = ['#3b82f6', '#ec4899', '#8b5cf6', '#10b981'];
                    const maxPrice = Math.max(...products.map(p => getBestPrice(p) || 0));
                    const maxReviewCount = Math.max(...products.map(p => p.rating.count));

                    // 価格は逆転（安いほど高スコア）
                    const priceScore = maxPrice > 0 ? (1 - (getBestPrice(product) || maxPrice) / maxPrice) * 80 : 40;
                    const durationScore = maxDuration > 0 ? ((product['duration'] || 0) / maxDuration) * 80 : 0;
                    const ratingScore = ((product['rating'].average || 0) / 5) * 80;
                    const reviewScore = maxReviewCount > 0 ? (product['rating'].count / maxReviewCount) * 80 : 0;

                    const points = getRadarDataPoints(100, 100, [priceScore, durationScore, ratingScore, reviewScore]);
                    return (
                      <g key={product['id']}>
                        <polygon
                          points={points}
                          fill={colors[idx % colors.length]}
                          fillOpacity="0.2"
                          stroke={colors[idx % colors.length]}
                          strokeWidth="2"
                        />
                        {points.split(' ').map((point, pi) => {
                          const [px, py] = point.split(',').map(Number);
                          return (
                            <circle
                              key={pi}
                              cx={px}
                              cy={py}
                              r="4"
                              fill={colors[idx % colors.length]}
                            />
                          );
                        })}
                      </g>
                    );
                  })}
                </svg>
              </div>
              {/* 凡例 */}
              <div className="flex flex-wrap justify-center gap-3 mt-3">
                {products.map((product, idx) => {
                  const colors = ['#3b82f6', '#ec4899', '#8b5cf6', '#10b981'];
                  return (
                    <div key={product['id']} className="flex items-center gap-1.5">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: colors[idx % colors.length] }}
                      />
                      <span className={`text-[10px] ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                        {product['title'].slice(0, 12)}{product['title'].length > 12 ? '…' : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* バーチャート */}
            <div className="flex-1">
              <p className={`text-xs mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {locale === 'ja' ? '棒グラフ比較' : 'Bar Comparison'}
              </p>
              <div className="space-y-4">
                {/* 価格（安いほど長いバー） */}
                <div>
                  <p className={`text-xs mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {locale === 'ja' ? '価格（安いほど高評価）' : 'Price (lower is better)'}
                  </p>
                  <div className="space-y-1.5">
                    {(() => {
                      const maxPrice = Math.max(...products.map(p => getBestPrice(p) || 0));
                      return products.map((product, idx) => {
                        const colors = ['bg-blue-500', 'bg-pink-500', 'bg-purple-500', 'bg-emerald-500'];
                        const price = getBestPrice(product) || maxPrice;
                        const percent = maxPrice > 0 ? ((maxPrice - price) / maxPrice) * 100 : 0;
                        return (
                          <div key={product['id']} className="flex items-center gap-2">
                            <span className={`text-[10px] w-20 truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              {product['title'].slice(0, 8)}
                            </span>
                            <div className={`flex-1 h-5 rounded-full overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                              <div
                                className={`h-full ${colors[idx % colors.length]} transition-all duration-500 rounded-full flex items-center justify-end pr-2`}
                                style={{ width: `${Math.max(percent, 5)}%` }}
                              >
                                <span className="text-[10px] text-white font-semibold">
                                  ¥{(price || 0).toLocaleString()}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
                {/* 再生時間 */}
                <div>
                  <p className={`text-xs mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {locale === 'ja' ? '再生時間' : 'Duration'}
                  </p>
                  <div className="space-y-1.5">
                    {products.map((product, idx) => {
                      const colors = ['bg-blue-500', 'bg-pink-500', 'bg-purple-500', 'bg-emerald-500'];
                      const percent = maxDuration > 0 ? ((product['duration'] || 0) / maxDuration) * 100 : 0;
                      return (
                        <div key={product['id']} className="flex items-center gap-2">
                          <span className={`text-[10px] w-20 truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {product['title'].slice(0, 8)}
                          </span>
                          <div className={`flex-1 h-5 rounded-full overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                            <div
                              className={`h-full ${colors[idx % colors.length]} transition-all duration-500 rounded-full flex items-center justify-end pr-2`}
                              style={{ width: `${Math.max(percent, 5)}%` }}
                            >
                              <span className="text-[10px] text-white font-semibold">
                                {formatDuration(product['duration'])}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* 評価 */}
                <div>
                  <p className={`text-xs mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {locale === 'ja' ? '評価' : 'Rating'}
                  </p>
                  <div className="space-y-1.5">
                    {products.map((product, idx) => {
                      const colors = ['bg-blue-500', 'bg-pink-500', 'bg-purple-500', 'bg-emerald-500'];
                      const percent = ((product['rating'].average || 0) / 5) * 100;
                      return (
                        <div key={product['id']} className="flex items-center gap-2">
                          <span className={`text-[10px] w-20 truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {product['title'].slice(0, 8)}
                          </span>
                          <div className={`flex-1 h-5 rounded-full overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                            <div
                              className={`h-full ${colors[idx % colors.length]} transition-all duration-500 rounded-full flex items-center justify-end pr-2`}
                              style={{ width: `${Math.max(percent, 5)}%` }}
                            >
                              <span className="text-[10px] text-white font-semibold">
                                ★{(product['rating'].average || 0).toFixed(1)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 共通点サマリー */}
      {comparison && (comparison.commonTags.length > 0 || comparison.commonPerformers.length > 0) && (
        <div className={`rounded-2xl p-5 ${
          isDark
            ? 'bg-gradient-to-r from-gray-800 to-gray-900 border border-gray-700'
            : 'bg-gradient-to-r from-gray-50 to-white border border-gray-200'
        }`}>
          <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}>
            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {locale === 'ja' ? '共通点' : 'Common Features'}
          </h3>
          <div className="flex flex-wrap gap-2">
            {comparison.commonPerformers.map((performer, i) => (
              <span
                key={`p-${i}`}
                className={`px-3 py-1.5 text-sm rounded-full flex items-center gap-1.5 ${
                  isDark
                    ? 'bg-green-900/50 text-green-400 border border-green-700'
                    : 'bg-green-100 text-green-700 border border-green-200'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                {performer}
              </span>
            ))}
            {comparison.commonTags.map((tag, i) => (
              <span
                key={`t-${i}`}
                className={`px-3 py-1.5 text-sm rounded-full flex items-center gap-1.5 ${
                  isDark
                    ? 'bg-blue-900/50 text-blue-400 border border-blue-700'
                    : 'bg-blue-100 text-blue-700 border border-blue-200'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
