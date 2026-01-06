'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Trophy, TrendingUp } from 'lucide-react';

// Client-side translations
const translations = {
  ja: {
    popularProducts: '人気作品ランキング',
    popularActresses: '人気女優ランキング',
    daily: '24時間',
    weekly: '週間',
    monthly: '月間',
    loading: '読み込み中...',
    noData: 'まだデータがありません',
    views: 'views',
  },
  en: {
    popularProducts: 'Popular Videos',
    popularActresses: 'Popular Actresses',
    daily: '24 Hours',
    weekly: 'Weekly',
    monthly: 'Monthly',
    loading: 'Loading...',
    noData: 'No data available yet',
    views: 'views',
  },
  zh: {
    popularProducts: '热门作品排行',
    popularActresses: '热门女优排行',
    daily: '24小时',
    weekly: '本周',
    monthly: '本月',
    loading: '加载中...',
    noData: '暂无数据',
    views: '次观看',
  },
  ko: {
    popularProducts: '인기 작품 랭킹',
    popularActresses: '인기 여배우 랭킹',
    daily: '24시간',
    weekly: '주간',
    monthly: '월간',
    loading: '로딩 중...',
    noData: '아직 데이터가 없습니다',
    views: '조회',
  },
} as const;

interface RankingItem {
  rank: number;
  productId?: number;
  performerId?: number;
  title?: string;
  name?: string;
  thumbnail?: string;
  image?: string;
  viewCount: number;
}

interface RankingWidgetProps {
  type: 'products' | 'actresses';
  period?: 'daily' | 'weekly' | 'monthly';
  limit?: number;
  locale: string;
  title?: string;
}

export default function RankingWidget({
  type,
  period = 'weekly',
  limit = 10,
  locale,
  title,
}: RankingWidgetProps) {
  const t = translations[locale as keyof typeof translations] || translations['ja'];
  const [ranking, setRanking] = useState<RankingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'daily' | 'weekly' | 'monthly'>(period);

  const fetchRanking = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/ranking/${type}?period=${selectedPeriod}&limit=${limit}`
      );
      const data = await response.json();
      setRanking(data.ranking || []);
    } catch (error: unknown) {
      if (process.env['NODE_ENV'] === 'development') {
        console.warn('[RankingWidget] Failed to fetch ranking:', error);
      }
      setRanking([]);
    } finally {
      setIsLoading(false);
    }
  }, [type, selectedPeriod, limit]);

  useEffect(() => {
    fetchRanking();
  }, [fetchRanking]);

  const getRankBadgeColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-yellow-500 text-yellow-900';
      case 2:
        return 'bg-gray-300 text-gray-900';
      case 3:
        return 'bg-amber-600 text-amber-100';
      default:
        return 'bg-gray-700 text-gray-200';
    }
  };

  const defaultTitle = type === 'products' ? t.popularProducts : t.popularActresses;

  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Trophy className="h-6 w-6 text-yellow-500" />
          {title || defaultTitle}
        </h2>
      </div>

      {/* Period selector */}
      <div className="flex gap-2 mb-4">
        {(['daily', 'weekly', 'monthly'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setSelectedPeriod(p)}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
              selectedPeriod === p
                ? 'bg-rose-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {p === 'daily' && t.daily}
            {p === 'weekly' && t.weekly}
            {p === 'monthly' && t.monthly}
          </button>
        ))}
      </div>

      {/* Ranking list */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-400">{t.loading}</div>
      ) : ranking.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>{t.noData}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {ranking.map((item) => {
            const href =
              type === 'products'
                ? `/${locale}/products/${item.productId}`
                : `/${locale}/actress/${item.performerId}`;

            return (
              <Link
                key={`${type}-${item.rank}`}
                href={href}
                className="flex items-center gap-3 p-3 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors"
              >
                {/* Rank badge */}
                <div
                  className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${getRankBadgeColor(
                    item.rank
                  )}`}
                >
                  {item.rank}
                </div>

                {/* Thumbnail */}
                {(item.thumbnail || item.image) && (
                  <div className="shrink-0 w-16 h-16 relative rounded overflow-hidden bg-gray-600">
                    <Image
                      src={item.thumbnail || item.image || ''}
                      alt={item.title || item.name || ''}
                      fill
                      className="object-cover"
                    />
                  </div>
                )}

                {/* Title/Name */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-medium truncate">
                    {item.title || item.name}
                  </h3>
                  <p className="text-sm text-gray-400">
                    {item.viewCount.toLocaleString()} {t.views}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
