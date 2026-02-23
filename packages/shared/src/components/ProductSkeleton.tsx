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
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="theme-skeleton-card animate-pulse overflow-hidden rounded-lg">
            <div className="theme-skeleton-image" style={{ aspectRatio: '2/3' }} />
            <div className="space-y-1 p-1.5">
              <div className="theme-skeleton-image h-2.5 w-full rounded" />
              <div className="theme-skeleton-image h-2.5 w-2/3 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (effectiveSize === 'compact') {
    // コンパクトスケルトン（8列グリッド）
    return (
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="theme-skeleton-card animate-pulse overflow-hidden rounded-lg">
            <div className="theme-skeleton-image" style={{ aspectRatio: '2/3' }} />
            <div className="space-y-1 p-2">
              <div className="theme-skeleton-image h-3 w-3/4 rounded" />
              <div className="theme-skeleton-image h-2 w-1/2 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // フルスケルトン（4列グリッド）
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="theme-skeleton-card animate-pulse overflow-hidden rounded-2xl">
          <div className="theme-skeleton-image" style={{ height: '18rem' }} />
          <div className="space-y-2 p-4">
            <div className="theme-skeleton-image h-4 w-3/4 rounded" />
            <div className="theme-skeleton-image h-3 w-1/2 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
