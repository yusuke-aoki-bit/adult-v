'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Trophy, TrendingUp } from 'lucide-react';

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
      if (process.env.NODE_ENV === 'development') {
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

  const defaultTitle = type === 'products' ? '人気作品ランキング' : '人気女優ランキング';

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
            {p === 'daily' && '24時間'}
            {p === 'weekly' && '週間'}
            {p === 'monthly' && '月間'}
          </button>
        ))}
      </div>

      {/* Ranking list */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-400">読み込み中...</div>
      ) : ranking.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>まだデータがありません</p>
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
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${getRankBadgeColor(
                    item.rank
                  )}`}
                >
                  {item.rank}
                </div>

                {/* Thumbnail */}
                {(item.thumbnail || item.image) && (
                  <div className="flex-shrink-0 w-16 h-16 relative rounded overflow-hidden bg-gray-600">
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
                    {item.viewCount.toLocaleString()} views
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
