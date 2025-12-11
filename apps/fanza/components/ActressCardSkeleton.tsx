'use client';

export default function ActressCardSkeleton({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="theme-card rounded-lg overflow-hidden animate-pulse">
        <div className="relative aspect-[3/4] theme-skeleton" />
        <div className="p-2 sm:p-3 space-y-1.5 sm:space-y-2 min-h-[52px] sm:min-h-[60px]">
          <div className="flex items-center justify-between">
            <div className="h-3 theme-skeleton rounded w-16" />
            <div className="h-4 theme-skeleton rounded w-12" />
          </div>
          <div className="flex gap-1">
            <div className="h-4 theme-skeleton rounded w-10" />
            <div className="h-4 theme-skeleton rounded w-12" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="theme-card rounded-2xl overflow-hidden animate-pulse">
      <div className="relative aspect-[4/5] theme-skeleton" />
      <div className="p-6 space-y-4">
        <div className="space-y-2">
          <div className="h-5 theme-skeleton rounded w-full" />
          <div className="h-4 theme-skeleton rounded w-3/4" />
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="h-6 theme-skeleton rounded-full w-16" />
          <div className="h-6 theme-skeleton rounded-full w-20" />
          <div className="h-6 theme-skeleton rounded-full w-14" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="h-16 theme-skeleton rounded-xl opacity-50" />
          <div className="h-16 theme-skeleton rounded-xl opacity-50" />
          <div className="h-16 theme-skeleton rounded-xl opacity-50" />
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
