'use client';

import { useState, useRef, useEffect, ReactNode } from 'react';

interface SwipeableCarouselProps {
  children: ReactNode[];
  autoPlay?: boolean;
  autoPlayInterval?: number;
  showDots?: boolean;
  showArrows?: boolean;
  theme?: 'dark' | 'light';
  className?: string;
}

export function SwipeableCarousel({
  children,
  autoPlay = false,
  autoPlayInterval = 5000,
  showDots = true,
  showArrows = true,
  theme = 'dark',
  className = '',
}: SwipeableCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const isDark = theme === 'dark';
  const itemCount = children.length;

  // 最小スワイプ距離
  const minSwipeDistance = 50;

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % itemCount);
  };

  const goToPrev = () => {
    setCurrentIndex((prev) => (prev - 1 + itemCount) % itemCount);
  };

  const goToIndex = (index: number) => {
    setCurrentIndex(index);
  };

  // 自動再生
  useEffect(() => {
    if (!autoPlay) return;

    const interval = setInterval(goToNext, autoPlayInterval);
    return () => clearInterval(interval);
  }, [autoPlay, autoPlayInterval, itemCount]);

  // タッチイベントハンドラー
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0]?.clientX ?? null);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0]?.clientX ?? null);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      goToNext();
    } else if (isRightSwipe) {
      goToPrev();
    }
  };

  if (itemCount === 0) return null;

  return (
    <div className={`relative ${className}`}>
      {/* カルーセルコンテナ */}
      <div
        ref={containerRef}
        className="overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {children.map((child, index) => (
            <div key={index} className="w-full shrink-0">
              {child}
            </div>
          ))}
        </div>
      </div>

      {/* 矢印ナビゲーション */}
      {showArrows && itemCount > 1 && (
        <>
          <button
            type="button"
            onClick={goToPrev}
            className={`absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full transition-colors ${
              isDark
                ? 'bg-gray-800/80 hover:bg-gray-700 text-white'
                : 'bg-white/80 hover:bg-white text-gray-800 shadow-lg'
            }`}
            aria-label="Previous"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={goToNext}
            className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full transition-colors ${
              isDark
                ? 'bg-gray-800/80 hover:bg-gray-700 text-white'
                : 'bg-white/80 hover:bg-white text-gray-800 shadow-lg'
            }`}
            aria-label="Next"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}

      {/* ドットインジケーター */}
      {showDots && itemCount > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {children.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => goToIndex(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentIndex
                  ? isDark ? 'bg-white w-4' : 'bg-pink-600 w-4'
                  : isDark ? 'bg-white/40' : 'bg-gray-400'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default SwipeableCarousel;
