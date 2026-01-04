'use client';

import dynamic from 'next/dynamic';

// チャートのローディングスケルトン
function ChartSkeleton({ height = 'h-[300px]' }: { height?: string }) {
  return (
    <div className={`w-full ${height} bg-gray-200 dark:bg-gray-700 animate-pulse rounded`} />
  );
}

// Dynamic imports for recharts components
export const DynamicReleasesTrendChart = dynamic(
  () => import('./ReleasesTrendChart'),
  {
    loading: () => <ChartSkeleton height="h-[300px]" />,
    ssr: false,
  }
);

export const DynamicGenreDistributionChart = dynamic(
  () => import('./GenreDistributionChart'),
  {
    loading: () => <ChartSkeleton height="h-[300px]" />,
    ssr: false,
  }
);

export const DynamicYearlyStatsChart = dynamic(
  () => import('./YearlyStatsChart'),
  {
    loading: () => <ChartSkeleton height="h-[300px]" />,
    ssr: false,
  }
);

export const DynamicMakerShareChart = dynamic(
  () => import('./MakerShareChart'),
  {
    loading: () => <ChartSkeleton height="h-[400px]" />,
    ssr: false,
  }
);

export const DynamicGenreTrendChart = dynamic(
  () => import('./GenreTrendChart'),
  {
    loading: () => <ChartSkeleton height="h-[400px]" />,
    ssr: false,
  }
);

export const DynamicDebutTrendChart = dynamic(
  () => import('./DebutTrendChart'),
  {
    loading: () => <ChartSkeleton height="h-[300px]" />,
    ssr: false,
  }
);
