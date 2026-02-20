'use client';

import { useState, useRef, ReactNode } from 'react';

interface PullToRefreshProps {
  children: ReactNode;
  onRefresh: () => Promise<void>;
  threshold?: number;
  locale?: string;
  theme?: 'dark' | 'light';
}

export function PullToRefresh({
  children,
  onRefresh,
  threshold = 80,
  locale = 'ja',
  theme = 'dark',
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const isDark = theme === 'dark';

  const texts = {
    ja: { pullToRefresh: '下に引いて更新', releaseToRefresh: '離して更新', refreshing: '更新中...' },
    en: { pullToRefresh: 'Pull to refresh', releaseToRefresh: 'Release to refresh', refreshing: 'Refreshing...' },
  } as const;
  const t = texts[locale as keyof typeof texts] || texts.ja;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (containerRef.current?.scrollTop === 0) {
      startY.current = e.touches[0]?.clientY ?? 0;
      setIsPulling(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling || isRefreshing) return;

    const currentY = e.touches[0]?.clientY ?? 0;
    const distance = Math.max(0, currentY - startY.current);

    // 抵抗を追加（距離が長くなるほど引きにくくなる）
    const dampedDistance = Math.min(distance * 0.5, threshold * 1.5);
    setPullDistance(dampedDistance);
  };

  const handleTouchEnd = async () => {
    if (!isPulling) return;

    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(threshold * 0.6);

      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }

    setIsPulling(false);
  };

  const showIndicator = pullDistance > 10 || isRefreshing;
  const isReady = pullDistance >= threshold;

  return (
    <div
      ref={containerRef}
      className="relative overflow-auto"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* リフレッシュインジケーター */}
      <div
        className={`absolute left-0 right-0 flex items-center justify-center transition-opacity ${
          showIndicator ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          top: 0,
          height: `${pullDistance}px`,
          zIndex: 10,
        }}
      >
        <div className={`flex items-center gap-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          {isRefreshing ? (
            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <svg
              className={`w-5 h-5 transition-transform ${isReady ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          )}
          <span className="text-sm">
            {isRefreshing
              ? t.refreshing
              : isReady
                ? t.releaseToRefresh
                : t.pullToRefresh}
          </span>
        </div>
      </div>

      {/* コンテンツ */}
      <div
        style={{
          transform: `translateY(${pullDistance}px)`,
          transition: isPulling ? 'none' : 'transform 0.2s ease-out',
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default PullToRefresh;
