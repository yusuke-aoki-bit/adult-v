'use client';

export default function ActressCardSkeleton({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="bg-gray-900 rounded-lg overflow-hidden shadow-lg ring-1 ring-white/10 animate-pulse">
        <div className="relative aspect-[3/4] bg-gradient-to-br from-gray-700 to-gray-600" />
        <div className="p-2 sm:p-3 space-y-1.5 sm:space-y-2 min-h-[52px] sm:min-h-[60px]">
          <div className="flex items-center justify-between">
            <div className="h-3 bg-gray-700 rounded w-16" />
            <div className="h-4 bg-gray-700 rounded w-12" />
          </div>
          <div className="flex gap-1">
            <div className="h-4 bg-gray-700 rounded w-10" />
            <div className="h-4 bg-gray-700 rounded w-12" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-2xl overflow-hidden shadow-xl ring-1 ring-white/10 animate-pulse">
      <div className="relative aspect-[4/5] bg-gradient-to-br from-gray-700 to-gray-600" />
      <div className="p-6 space-y-4">
        <div className="space-y-2">
          <div className="h-5 bg-gray-700 rounded w-full" />
          <div className="h-4 bg-gray-700 rounded w-3/4" />
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="h-6 bg-gray-700 rounded-full w-16" />
          <div className="h-6 bg-gray-700 rounded-full w-20" />
          <div className="h-6 bg-gray-700 rounded-full w-14" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="h-16 bg-gray-700/50 rounded-xl" />
          <div className="h-16 bg-gray-700/50 rounded-xl" />
          <div className="h-16 bg-gray-700/50 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function ActressCardSkeletonGrid({ count = 12, compact = true }: { count?: number; compact?: boolean }) {
  return (
    <div className={`grid gap-3 sm:gap-4 ${
      compact
        ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
        : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
    }`}>
      {Array.from({ length: count }).map((_, i) => (
        <ActressCardSkeleton key={i} compact={compact} />
      ))}
    </div>
  );
}
