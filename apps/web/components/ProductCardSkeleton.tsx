'use client';

export default function ProductCardSkeleton() {
  return (
    <div className="bg-gray-800 rounded-2xl shadow-lg overflow-hidden animate-pulse">
      {/* 画像プレースホルダー */}
      <div className="relative bg-linear-to-br from-gray-700 to-gray-600" style={{ aspectRatio: '3/4' }} />

      {/* テキストプレースホルダー */}
      <div className="p-4 space-y-3">
        {/* タイトル */}
        <div className="space-y-2">
          <div className="h-4 bg-gray-700 rounded w-full" />
          <div className="h-4 bg-gray-700 rounded w-3/4" />
        </div>

        {/* サブ情報 */}
        <div className="flex items-center gap-2">
          <div className="h-3 bg-gray-700 rounded w-16" />
          <div className="h-3 bg-gray-700 rounded w-20" />
        </div>

        {/* 価格 */}
        <div className="h-6 bg-gray-700 rounded w-24" />

        {/* ボタン */}
        <div className="flex gap-2 pt-2">
          <div className="flex-1 h-10 bg-gray-700 rounded-xl" />
          <div className="w-10 h-10 bg-gray-700 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function ProductCardSkeletonGrid({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
