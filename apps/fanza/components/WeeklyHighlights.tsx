'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { TrendingUp, Sparkles, Clock, User, Film, ChevronDown, ChevronUp, Star } from 'lucide-react';

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

interface WeeklyHighlightsProps {
  locale: string;
}

const translations = {
  ja: {
    title: '今週の注目',
    subtitle: '閲覧データに基づく自動キュレーション',
    trendingActresses: '急上昇女優',
    hotNewReleases: '話題の新作',
    rediscoveredClassics: '再評価作品',
    viewsUp: '閲覧 +',
    products: '作品',
    rating: '評価',
    views: '閲覧',
    yearsAgo: '年前',
    loading: '読み込み中...',
    noData: 'データがありません',
  },
  en: {
    title: 'This Week\'s Highlights',
    subtitle: 'Auto-curated based on viewing data',
    trendingActresses: 'Trending Actresses',
    hotNewReleases: 'Hot New Releases',
    rediscoveredClassics: 'Rediscovered Classics',
    viewsUp: 'Views +',
    products: 'works',
    rating: 'Rating',
    views: 'views',
    yearsAgo: 'years ago',
    loading: 'Loading...',
    noData: 'No data available',
  },
  zh: {
    title: '本周热门',
    subtitle: '基于浏览数据自动推荐',
    trendingActresses: '人气上升女优',
    hotNewReleases: '热门新作',
    rediscoveredClassics: '经典重温',
    viewsUp: '浏览 +',
    products: '作品',
    rating: '评分',
    views: '次浏览',
    yearsAgo: '年前',
    loading: '加载中...',
    noData: '暂无数据',
  },
  ko: {
    title: '이번 주 주목',
    subtitle: '조회 데이터 기반 자동 큐레이션',
    trendingActresses: '인기 상승 여배우',
    hotNewReleases: '화제의 신작',
    rediscoveredClassics: '재발견 작품',
    viewsUp: '조회 +',
    products: '작품',
    rating: '평점',
    views: '조회',
    yearsAgo: '년 전',
    loading: '로딩 중...',
    noData: '데이터 없음',
  },
} as const;

export default function WeeklyHighlights({ locale }: WeeklyHighlightsProps) {
  const [data, setData] = useState<WeeklyHighlightsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);

  const t = translations[locale as keyof typeof translations] || translations.ja;

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('/api/weekly-highlights');
        if (response.ok) {
          const json = await response.json();
          setData(json);
        }
      } catch (error) {
        console.error('Failed to fetch weekly highlights:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  const hasData = data && (
    data.trendingActresses.length > 0 ||
    data.hotNewReleases.length > 0 ||
    data.rediscoveredClassics.length > 0
  );

  if (!hasData && !isLoading) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-amber-100 to-orange-100 rounded-xl p-4 sm:p-6 border border-amber-300/50 mb-8">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between mb-4"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/20 rounded-lg">
            <TrendingUp className="h-5 w-5 text-amber-600" />
          </div>
          <div className="text-left">
            <h2 className="text-lg font-bold text-gray-800">{t.title}</h2>
            <p className="text-sm text-gray-500">{t.subtitle}</p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-gray-500" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-500" />
        )}
      </button>

      {isExpanded && (
        <>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-3">
                  <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
                  <div className="grid grid-cols-3 gap-2">
                    {[1, 2, 3].map((j) => (
                      <div key={j} className="bg-white rounded-lg overflow-hidden animate-pulse border border-gray-200">
                        <div className="aspect-square bg-gray-200" />
                        <div className="p-2 space-y-1">
                          <div className="h-3 bg-gray-200 rounded w-3/4" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Trending Actresses */}
              {data?.trendingActresses && data.trendingActresses.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-amber-700 mb-3 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    {t.trendingActresses}
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {data.trendingActresses.slice(0, 3).map((actress) => (
                      <Link
                        key={actress.id}
                        href={`/${locale}/actress/${actress.id}`}
                        className="group bg-white rounded-lg overflow-hidden hover:ring-2 hover:ring-amber-500/50 transition-all border border-gray-200 shadow-sm"
                      >
                        <div className="aspect-square relative bg-gray-100">
                          {actress.heroImageUrl || actress.thumbnailUrl ? (
                            <Image
                              src={actress.heroImageUrl || actress.thumbnailUrl || ''}
                              alt={actress.name}
                              fill
                              className="object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full">
                              <User className="h-8 w-8 text-gray-400" />
                            </div>
                          )}
                          {actress.growthRate > 0 && (
                            <div className="absolute top-1 right-1 bg-green-600 text-white text-[10px] font-bold px-1 py-0.5 rounded flex items-center gap-0.5">
                              <TrendingUp className="h-2.5 w-2.5" />
                              {actress.growthRate}%
                            </div>
                          )}
                        </div>
                        <div className="p-1.5">
                          <p className="text-gray-800 text-xs font-medium truncate group-hover:text-amber-600 transition-colors">
                            {actress.name}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Hot New Releases */}
              {data?.hotNewReleases && data.hotNewReleases.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-orange-700 mb-3 flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    {t.hotNewReleases}
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {data.hotNewReleases.slice(0, 3).map((product) => (
                      <Link
                        key={product.id}
                        href={`/${locale}/products/${product.id}`}
                        className="group bg-white rounded-lg overflow-hidden hover:ring-2 hover:ring-orange-500/50 transition-all border border-gray-200 shadow-sm"
                      >
                        <div className="aspect-[2/3] relative bg-gray-100">
                          {product.imageUrl ? (
                            <Image
                              src={product.imageUrl}
                              alt={product.title}
                              fill
                              className="object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full">
                              <Film className="h-8 w-8 text-gray-400" />
                            </div>
                          )}
                          {product.rating && product.rating > 0 && (
                            <div className="absolute top-1 right-1 bg-yellow-500 text-black text-[10px] font-bold px-1 py-0.5 rounded flex items-center gap-0.5">
                              <Star className="h-2.5 w-2.5 fill-current" />
                              {product.rating.toFixed(1)}
                            </div>
                          )}
                        </div>
                        <div className="p-1.5">
                          <p className="text-gray-800 text-xs font-medium line-clamp-2 group-hover:text-orange-600 transition-colors">
                            {product.title}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Rediscovered Classics */}
              {data?.rediscoveredClassics && data.rediscoveredClassics.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-rose-700 mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {t.rediscoveredClassics}
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {data.rediscoveredClassics.slice(0, 3).map((product) => (
                      <Link
                        key={product.id}
                        href={`/${locale}/products/${product.id}`}
                        className="group bg-white rounded-lg overflow-hidden hover:ring-2 hover:ring-rose-500/50 transition-all border border-gray-200 shadow-sm"
                      >
                        <div className="aspect-[2/3] relative bg-gray-100">
                          {product.imageUrl ? (
                            <Image
                              src={product.imageUrl}
                              alt={product.title}
                              fill
                              className="object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full">
                              <Film className="h-8 w-8 text-gray-400" />
                            </div>
                          )}
                          <div className="absolute top-1 right-1 bg-rose-600 text-white text-[10px] font-bold px-1 py-0.5 rounded">
                            {Math.floor(product.daysSinceRelease / 365)}{t.yearsAgo}
                          </div>
                        </div>
                        <div className="p-1.5">
                          <p className="text-gray-800 text-xs font-medium line-clamp-2 group-hover:text-rose-600 transition-colors">
                            {product.title}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
