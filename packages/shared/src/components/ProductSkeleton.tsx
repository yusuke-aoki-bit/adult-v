interface ProductSkeletonProps {
  /** スケルトンアイテム数 */
  count?: number;
  /** コンパクトモード（8列グリッド） */
  compact?: boolean;
}

/**
 * 商品カードのローディングスケルトン
 * ForYouRecommendations, SalesSection, RecentlyViewed などで共通使用
 * テーマはCSSクラス変数（theme-*）で制御
 */
export default function ProductSkeleton({ count = 8, compact = false }: ProductSkeletonProps) {
  if (compact) {
    // コンパクトスケルトン（8列グリッド）
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="theme-skeleton-card rounded-lg overflow-hidden animate-pulse">
            <div className="aspect-[2/3] theme-skeleton-image" />
            <div className="p-2 space-y-1">
              <div className="h-3 theme-skeleton-image rounded w-3/4" />
              <div className="h-2 theme-skeleton-image rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // 通常スケルトン（4列グリッド）
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="theme-skeleton-card rounded-2xl overflow-hidden animate-pulse">
          <div className="h-72 theme-skeleton-image" />
          <div className="p-4 space-y-2">
            <div className="h-4 theme-skeleton-image rounded w-3/4" />
            <div className="h-3 theme-skeleton-image rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
