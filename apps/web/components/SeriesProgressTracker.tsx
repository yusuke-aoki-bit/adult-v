'use client';

import { useState, useEffect } from 'react';
import { useRecentlyViewed } from '@/hooks';

interface SeriesProgressTrackerProps {
  seriesId: string;
  totalProducts: number;
  productIds: string[];
  translations: {
    watched: string;
    notWatched: string;
  };
}

export default function SeriesProgressTracker({
  seriesId: _seriesId,
  totalProducts,
  productIds,
  translations: _translations,
}: SeriesProgressTrackerProps) {
  const { items: viewedItems, isLoading } = useRecentlyViewed();
  const [watchedCount, setWatchedCount] = useState(0);

  useEffect(() => {
    if (isLoading) return;

    // 視聴済みの作品IDを取得
    const viewedIds = new Set(viewedItems.map((item) => item.id));

    // シリーズ内の視聴済み作品数をカウント
    const count = productIds.filter((id) => viewedIds.has(id)).length;
    setWatchedCount(count);
  }, [viewedItems, productIds, isLoading]);

  const progress = totalProducts > 0 ? Math.round((watchedCount / totalProducts) * 100) : 0;

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-6 w-16 rounded bg-gray-700"></div>
      </div>
    );
  }

  return (
    <div>
      <p className="theme-text text-2xl font-bold">
        {watchedCount}/{totalProducts}
        <span className="ml-1 text-sm">({progress}%)</span>
      </p>
      {/* プログレスバー */}
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-700">
        <div
          className="h-full bg-linear-to-r from-purple-500 to-fuchsia-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
