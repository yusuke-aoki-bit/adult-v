type SkeletonSize = 'full' | 'compact' | 'mini';

interface ProductSkeletonProps {
  /** スケルトンアイテム数 */
  count?: number;
  /** サイズ: 'full', 'compact', 'mini' */
  size?: SkeletonSize;
  /** @deprecated Use size='compact' instead */
  compact?: boolean;
}

/**
 * 商品カードのローディングスケルトン
 * ForYouRecommendations, SalesSection, RecentlyViewed などで共通使用
 * テーマはCSSクラス変数（theme-*）で制御
 */
export default function ProductSkeleton({ count = 8, size, compact = false }: ProductSkeletonProps) {
  // Determine effective size
  const effectiveSize: SkeletonSize = size || (compact ? 'compact' : 'full');

  if (effectiveSize === 'mini') {
    // ミニスケルトン（セクション用: 4-6-8列グリッド）
    // ProductCardのminiサイズに合わせて、タイトル2行分の高さを確保
    return (
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="theme-skeleton-card rounded-lg overflow-hidden animate-pulse">
            <div className="theme-skeleton-image" style={{ aspectRatio: '2/3' }} />
            <div className="p-1.5 space-y-1">
              <div className="h-2.5 theme-skeleton-image rounded w-full" />
              <div className="h-2.5 theme-skeleton-image rounded w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (effectiveSize === 'compact') {
    // コンパクトスケルトン（8列グリッド）
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="theme-skeleton-card rounded-lg overflow-hidden animate-pulse">
            <div className="theme-skeleton-image" style={{ aspectRatio: '2/3' }} />
            <div className="p-2 space-y-1">
              <div className="h-3 theme-skeleton-image rounded w-3/4" />
              <div className="h-2 theme-skeleton-image rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // フルスケルトン（4列グリッド）
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="theme-skeleton-card rounded-2xl overflow-hidden animate-pulse">
          <div className="theme-skeleton-image" style={{ height: '18rem' }} />
          <div className="p-4 space-y-2">
            <div className="h-4 theme-skeleton-image rounded w-3/4" />
            <div className="h-3 theme-skeleton-image rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
