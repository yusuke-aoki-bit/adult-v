'use client';

export default function ActressCardSkeleton({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="theme-card animate-pulse overflow-hidden rounded-lg">
        <div className="theme-skeleton relative" style={{ aspectRatio: '3/4' }} />
        <div className="min-h-[52px] space-y-1.5 p-2 sm:min-h-[60px] sm:space-y-2 sm:p-3">
          <div className="flex items-center justify-between">
            <div className="theme-skeleton h-3 w-16 rounded" />
            <div className="theme-skeleton h-4 w-12 rounded" />
          </div>
          <div className="flex gap-1">
            <div className="theme-skeleton h-4 w-10 rounded" />
            <div className="theme-skeleton h-4 w-12 rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="theme-card animate-pulse overflow-hidden rounded-2xl">
      <div className="theme-skeleton relative" style={{ aspectRatio: '4/5' }} />
      <div className="space-y-4 p-6">
        <div className="space-y-2">
          <div className="theme-skeleton h-5 w-full rounded" />
          <div className="theme-skeleton h-4 w-3/4 rounded" />
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="theme-skeleton h-6 w-16 rounded-full" />
          <div className="theme-skeleton h-6 w-20 rounded-full" />
          <div className="theme-skeleton h-6 w-14 rounded-full" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="theme-skeleton h-16 rounded-xl opacity-50" />
          <div className="theme-skeleton h-16 rounded-xl opacity-50" />
          <div className="theme-skeleton h-16 rounded-xl opacity-50" />
        </div>
      </div>
    </div>
  );
}

export function ActressCardSkeletonGrid({ count = 12, compact = true }: { count?: number; compact?: boolean }) {
  return (
    <div
      className={`grid gap-3 sm:gap-4 ${
        compact
          ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
          : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
      }`}
    >
      {Array.from({ length: count }).map((_, i) => (
        <ActressCardSkeleton key={i} compact={compact} />
      ))}
    </div>
  );
}
