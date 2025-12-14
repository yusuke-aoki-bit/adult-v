'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Building2, Tag, Star, ChevronRight, ChevronDown } from 'lucide-react';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';

interface MakerPreference {
  makerId: number;
  makerName: string;
  category: string;
  count: number;
  averageRating: number | null;
}

const translations = {
  ja: {
    title: 'メーカー傾向分析',
    subtitle: 'あなたの視聴履歴から分析',
    topMakers: 'よく見るメーカー',
    topLabels: 'よく見るレーベル',
    viewCount: '視聴数',
    avgRating: '平均評価',
    viewMore: 'もっと見る',
    noData: 'データがありません',
    noDataDesc: '作品を視聴すると傾向が分析されます',
    matchRate: '一致率',
    works: '作品',
  },
  en: {
    title: 'Maker Analysis',
    subtitle: 'Based on your viewing history',
    topMakers: 'Top Makers',
    topLabels: 'Top Labels',
    viewCount: 'Views',
    avgRating: 'Avg Rating',
    viewMore: 'View More',
    noData: 'No data',
    noDataDesc: 'Watch more to see analysis',
    matchRate: 'Match',
    works: 'works',
  },
  zh: {
    title: '厂商偏好分析',
    subtitle: '基于您的观看历史',
    topMakers: '常看厂商',
    topLabels: '常看品牌',
    viewCount: '观看数',
    avgRating: '平均评分',
    viewMore: '查看更多',
    noData: '暂无数据',
    noDataDesc: '观看更多后可查看分析',
    matchRate: '匹配度',
    works: '部',
  },
  ko: {
    title: '메이커 분석',
    subtitle: '시청 기록 기반 분석',
    topMakers: '자주 보는 메이커',
    topLabels: '자주 보는 레이블',
    viewCount: '시청 수',
    avgRating: '평균 평점',
    viewMore: '더 보기',
    noData: '데이터 없음',
    noDataDesc: '더 많이 시청하면 분석이 표시됩니다',
    matchRate: '일치율',
    works: '작품',
  },
} as const;

interface MakerAnalysisProps {
  locale: string;
  className?: string;
}

export default function MakerAnalysis({ locale, className = '' }: MakerAnalysisProps) {
  const t = translations[locale as keyof typeof translations] || translations.ja;
  const { items: viewedItems, isLoading: isViewLoading } = useRecentlyViewed();
  const [makers, setMakers] = useState<MakerPreference[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    async function fetchMakerAnalysis() {
      if (viewedItems.length === 0) return;

      setIsLoading(true);
      try {
        const productIds = viewedItems
          .map(item => parseInt(item.id, 10))
          .filter(id => !isNaN(id));

        if (productIds.length === 0) return;

        const res = await fetch('/api/makers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productIds, locale }),
        });
        const data = await res.json();
        setMakers(data.makers || []);
      } catch (error) {
        console.error('Error fetching maker analysis:', error);
      } finally {
        setIsLoading(false);
      }
    }

    if (!isViewLoading) {
      fetchMakerAnalysis();
    }
  }, [viewedItems, isViewLoading, locale]);

  if (isViewLoading || isLoading) {
    return (
      <div className={`bg-white rounded-lg p-6 shadow ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 w-40 bg-gray-200 rounded mb-4" />
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-gray-200 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (makers.length === 0) {
    return (
      <div className={`bg-white rounded-lg p-6 shadow ${className}`}>
        <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-blue-500" />
          {t.title}
        </h3>
        <p className="text-sm text-gray-500">{t.noDataDesc}</p>
      </div>
    );
  }

  const topMakers = makers.filter(m => m.category === 'maker');
  const topLabels = makers.filter(m => m.category === 'label');
  const totalViews = makers.reduce((sum, m) => sum + m.count, 0);
  const displayedMakers = isExpanded ? makers : makers.slice(0, 5);

  return (
    <div className={`bg-white rounded-lg p-6 shadow ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-500" />
            {t.title}
          </h3>
          <p className="text-sm text-gray-500">{t.subtitle}</p>
        </div>
      </div>

      <div className="space-y-3">
        {displayedMakers.map((maker, index) => {
          const percentage = Math.round((maker.count / totalViews) * 100);
          return (
            <Link
              key={maker.makerId}
              href={`/${locale}/makers/${maker.makerId}`}
              className="block group"
            >
              <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                  index === 0 ? 'bg-yellow-400 text-yellow-900' :
                  index === 1 ? 'bg-gray-300 text-gray-700' :
                  index === 2 ? 'bg-amber-500 text-white' :
                  'bg-gray-200 text-gray-600'
                }`}>
                  {index + 1}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-gray-900 font-medium truncate group-hover:text-blue-600 transition-colors">
                      {maker.makerName}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      maker.category === 'maker'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-purple-100 text-purple-700'
                    }`}>
                      {maker.category === 'maker' ? (
                        <Building2 className="w-3 h-3 inline" />
                      ) : (
                        <Tag className="w-3 h-3 inline" />
                      )}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-500">
                      {maker.count} {t.works}
                    </span>
                    <span className="text-blue-600">
                      {percentage}%
                    </span>
                    {maker.averageRating && (
                      <span className="text-yellow-600 flex items-center gap-1">
                        <Star className="w-3 h-3" />
                        {maker.averageRating.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>

                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors flex-shrink-0" />
              </div>
            </Link>
          );
        })}
      </div>

      {makers.length > 5 && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full mt-4 py-2 text-sm text-gray-500 hover:text-gray-700 flex items-center justify-center gap-1 transition-colors"
        >
          {isExpanded ? (
            <>
              <ChevronDown className="w-4 h-4 rotate-180" />
              Show Less
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              {t.viewMore} ({makers.length - 5})
            </>
          )}
        </button>
      )}

      {(topMakers.length > 0 || topLabels.length > 0) && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-4">
            {topMakers.length > 0 && (
              <div>
                <h4 className="text-sm text-gray-500 mb-2 flex items-center gap-1">
                  <Building2 className="w-4 h-4" />
                  {t.topMakers}
                </h4>
                <div className="flex flex-wrap gap-1">
                  {topMakers.slice(0, 3).map(m => (
                    <Link
                      key={m.makerId}
                      href={`/${locale}/makers/${m.makerId}`}
                      className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors"
                    >
                      {m.makerName}
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {topLabels.length > 0 && (
              <div>
                <h4 className="text-sm text-gray-500 mb-2 flex items-center gap-1">
                  <Tag className="w-4 h-4" />
                  {t.topLabels}
                </h4>
                <div className="flex flex-wrap gap-1">
                  {topLabels.slice(0, 3).map(m => (
                    <Link
                      key={m.makerId}
                      href={`/${locale}/makers/${m.makerId}`}
                      className="text-xs px-2 py-1 bg-purple-50 text-purple-700 rounded hover:bg-purple-100 transition-colors"
                    >
                      {m.makerName}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
