interface ProductSkeletonProps {
  /** スケルトンアイテム数 */
  count?: number;
  /** コンパクトモード（8列グリッド、ダークテーマ） */
  compact?: boolean;
}

/**
 * 商品カードのローディングスケルトン
 * ForYouRecommendations, SalesSection, RecentlyViewed などで共通使用
 */
export default function ProductSkeleton({ count = 4, compact = false }: ProductSkeletonProps) {
  if (compact) {
    // ダークテーマ用コンパクトスケルトン
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

  // FANZAライトテーマ用スケルトン（デフォルト）
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-gray-100 rounded-2xl overflow-hidden animate-pulse">
          <div className="h-72 bg-gray-200" />
          <div className="p-4 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-3 bg-gray-200 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
