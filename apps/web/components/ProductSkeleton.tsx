interface ProductSkeletonProps {
  /** スケルトンアイテム数 */
  count?: number;
}

/**
 * 商品カードのローディングスケルトン
 * ForYouRecommendations, SalesSection, RecentlyViewed などで共通使用
 */
export default function ProductSkeleton({ count = 8 }: ProductSkeletonProps) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-gray-800 rounded-lg overflow-hidden animate-pulse">
          <div className="aspect-2/3 bg-gray-700" />
          <div className="p-2 space-y-1">
            <div className="h-3 bg-gray-700 rounded w-3/4" />
            <div className="h-2 bg-gray-700 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
