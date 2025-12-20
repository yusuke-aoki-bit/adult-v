'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, Sparkles, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { useParams } from 'next/navigation';
import ActressCard from './ActressCard';
import ProductCard from './ProductCard';
import type { Actress, Product } from '@/types/product';

interface TrendingActress {
  id: number;
  name: string;
  thumbnailUrl: string | null;
  heroImageUrl: string | null;
  productCount: number;
  viewsThisWeek: number;
  growthRate: number;
}

interface HotNewRelease {
  id: number;
  title: string;
  imageUrl: string | null;
  releaseDate: string | null;
  rating: number | null;
  viewCount: number;
}

interface RediscoveredClassic {
  id: number;
  title: string;
  imageUrl: string | null;
  releaseDate: string | null;
  recentViews: number;
  daysSinceRelease: number;
}

interface WeeklyHighlightsData {
  trendingActresses: TrendingActress[];
  hotNewReleases: HotNewRelease[];
  rediscoveredClassics: RediscoveredClassic[];
}

// TrendingActressをActress型に変換
function toActressType(actress: TrendingActress): Actress {
  return {
    id: String(actress.id),
    name: actress.name,
    catchcopy: '',
    description: '',
    heroImage: actress.heroImageUrl || '',
    thumbnail: actress.thumbnailUrl || '',
    primaryGenres: [],
    services: [],
    metrics: {
      releaseCount: actress.productCount,
      trendingScore: actress.growthRate,
      fanScore: 0,
    },
    highlightWorks: [],
    tags: [],
  };
}

// HotNewRelease/RediscoveredClassicをProduct型に変換
function toProductType(product: HotNewRelease | RediscoveredClassic): Product {
  return {
    id: String(product.id),
    normalizedProductId: undefined,
    title: product.title,
    description: '',
    price: 0,
    category: 'all',
    imageUrl: product.imageUrl || '',
    affiliateUrl: '',
    provider: 'unknown' as const,
    providerLabel: '',
    releaseDate: product.releaseDate || undefined,
    rating: 'rating' in product ? product.rating || undefined : undefined,
  };
}

interface WeeklyHighlightsProps {
  locale: string;
}

/**
 * 今週の注目セクション
 * ActressCardとProductCardのcompactモードを使用
 */
export default function WeeklyHighlights({ locale: propLocale }: WeeklyHighlightsProps) {
  const params = useParams();
  const locale = (params?.locale as string) || propLocale || 'ja';

  const [data, setData] = useState<WeeklyHighlightsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  // 遅延フェッチ: 展開されたときのみデータを取得
  useEffect(() => {
    if (!isExpanded || hasFetched) return;

    async function doFetch() {
      try {
        const response = await fetch('/api/weekly-highlights');
        if (response.ok) {
          const highlights = await response.json();
          setData(highlights);
        } else {
          setData({ trendingActresses: [], hotNewReleases: [], rediscoveredClassics: [] });
        }
        setHasFetched(true);
      } catch (error) {
        console.error('Failed to fetch weekly highlights:', error);
      } finally {
        setIsLoading(false);
      }
    }

    doFetch();
  }, [isExpanded, hasFetched]);

  const hasData = data && (
    data.trendingActresses.length > 0 ||
    data.hotNewReleases.length > 0 ||
    data.rediscoveredClassics.length > 0
  );

  // フェッチ後にデータがなければ非表示
  if (hasFetched && !hasData && !isLoading) {
    return null;
  }

  return (
    <section className="py-3 sm:py-4">
      <div className="container mx-auto px-3 sm:px-4">
        <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 rounded-2xl p-4 sm:p-6 border border-red-900/30 shadow-lg shadow-red-900/10">
          {/* Header */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center justify-between mb-4"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-900/30 rounded-lg">
                <TrendingUp className="h-5 w-5 text-red-400" />
              </div>
              <div className="text-left">
                <h2 className="text-lg font-bold text-white">今週の注目</h2>
                <p className="text-sm text-gray-400">トレンド・新作・再発見</p>
              </div>
            </div>
            {isExpanded ? (
              <ChevronUp className="h-5 w-5 text-gray-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-400" />
            )}
          </button>

          {isExpanded && (
            <>
              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="space-y-3">
                      <div className="h-6 w-32 bg-gray-700 rounded animate-pulse" />
                      <div className="grid grid-cols-3 gap-2">
                        {[1, 2, 3].map((j) => (
                          <div key={j} className="bg-gray-800 rounded-lg overflow-hidden animate-pulse">
                            <div className="bg-gray-700" style={{ aspectRatio: '3/4' }} />
                            <div className="p-2 space-y-1">
                              <div className="h-3 bg-gray-700 rounded w-3/4" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Trending Actresses - ActressCard compact */}
                  {data?.trendingActresses && data.trendingActresses.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        急上昇の女優
                      </h3>
                      <div className="grid grid-cols-3 gap-2">
                        {data.trendingActresses.slice(0, 3).map((actress) => (
                          <div key={actress.id} className="relative">
                            <ActressCard
                              actress={toActressType(actress)}
                              compact
                            />
                            {/* 成長率バッジ */}
                            {actress.growthRate > 0 && (
                              <div className="absolute top-1 left-1 bg-green-600 text-white text-[10px] font-bold px-1 py-0.5 rounded flex items-center gap-0.5 z-20">
                                <TrendingUp className="h-2.5 w-2.5" />
                                {actress.growthRate}%
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Hot New Releases - ProductCard compact */}
                  {data?.hotNewReleases && data.hotNewReleases.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-orange-400 mb-3 flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        話題の新作
                      </h3>
                      <div className="grid grid-cols-3 gap-2">
                        {data.hotNewReleases.slice(0, 3).map((product) => (
                          <ProductCard
                            key={product.id}
                            product={toProductType(product)}
                            compact
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Rediscovered Classics - ProductCard compact */}
                  {data?.rediscoveredClassics && data.rediscoveredClassics.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-rose-400 mb-3 flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        再評価作品
                      </h3>
                      <div className="grid grid-cols-3 gap-2">
                        {data.rediscoveredClassics.slice(0, 3).map((product) => (
                          <div key={product.id} className="relative">
                            <ProductCard
                              product={toProductType(product)}
                              compact
                            />
                            {/* 年数バッジ */}
                            <div className="absolute top-1 left-1 bg-rose-600 text-white text-[10px] font-bold px-1 py-0.5 rounded z-20">
                              {Math.floor(product.daysSinceRelease / 365)}年前
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
