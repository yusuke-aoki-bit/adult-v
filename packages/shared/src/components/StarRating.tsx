'use client';

type StarRatingTheme = 'dark' | 'light';

interface StarRatingProps {
  rating: number;
  reviewCount?: number;
  size?: 'sm' | 'md' | 'lg';
  showCount?: boolean;
  className?: string;
  /** テーマ: dark (web用), light (fanza用) */
  theme?: StarRatingTheme;
}

/**
 * 星評価表示コンポーネント
 * 5段階の星で評価を視覚的に表示
 */
export default function StarRating({
  rating,
  reviewCount,
  size = 'sm',
  showCount = true,
  className = '',
  theme = 'dark',
}: StarRatingProps) {
  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const textSizeClasses = {
    sm: 'text-[10px]',
    md: 'text-xs',
    lg: 'text-sm',
  };

  // テーマに応じた未塗り星の色
  const unfilledStarColor = theme === 'dark' ? 'text-gray-600' : 'text-gray-300';

  // 評価に応じた色分け
  const getRatingColor = (rating: number) => {
    if (rating >= 4.5) return 'text-yellow-400';
    if (rating >= 4.0) return 'text-yellow-500';
    if (rating >= 3.5) return 'text-amber-500';
    return 'text-gray-400';
  };

  const ratingColor = getRatingColor(rating);
  const roundedRating = Math.round(rating * 2) / 2; // 0.5刻みに丸める

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = star <= Math.floor(roundedRating);
          const isHalf = !isFilled && star === Math.ceil(roundedRating) && roundedRating % 1 !== 0;

          return (
            <svg
              key={star}
              className={`${sizeClasses[size]} ${isFilled || isHalf ? ratingColor : unfilledStarColor}`}
              fill={isFilled ? 'currentColor' : isHalf ? 'url(#half-gradient)' : 'none'}
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              {isHalf && (
                <defs>
                  <linearGradient id="half-gradient">
                    <stop offset="50%" stopColor="currentColor" />
                    <stop offset="50%" stopColor="transparent" />
                  </linearGradient>
                </defs>
              )}
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
              />
            </svg>
          );
        })}
      </div>
      <span className={`${textSizeClasses[size]} font-semibold ${ratingColor}`}>
        {rating.toFixed(1)}
      </span>
      {showCount && reviewCount !== undefined && reviewCount > 0 && (
        <span className={`${textSizeClasses[size]} text-gray-500`}>
          ({reviewCount.toLocaleString()})
        </span>
      )}
    </div>
  );
}
