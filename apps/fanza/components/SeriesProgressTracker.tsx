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

    const viewedIds = new Set(viewedItems.map(item => item.id));
    const count = productIds.filter(id => viewedIds.has(id)).length;
    setWatchedCount(count);
  }, [viewedItems, productIds, isLoading]);

  const progress = totalProducts > 0 ? Math.round((watchedCount / totalProducts) * 100) : 0;

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-16"></div>
      </div>
    );
  }

  return (
    <div>
      <p className="text-2xl font-bold text-gray-900">
        {watchedCount}/{totalProducts}
        <span className="text-sm ml-1">({progress}%)</span>
      </p>
      <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-linear-to-r from-purple-500 to-pink-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
