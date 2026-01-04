export { default as ReleasesTrendChart } from './ReleasesTrendChart';
export { default as GenreDistributionChart } from './GenreDistributionChart';
export { default as YearlyStatsChart } from './YearlyStatsChart';
export { default as MakerShareChart } from './MakerShareChart';
export { default as GenreTrendChart } from './GenreTrendChart';
export { default as DebutTrendChart } from './DebutTrendChart';
export { default as ReleaseCalendar } from './ReleaseCalendar';
export { default as ReleaseCalendarWrapper } from './ReleaseCalendarWrapper';
export { default as CalendarGrid } from './CalendarGrid';
export { default as CalendarGridWrapper } from './CalendarGridWrapper';

// Dynamic imports for code splitting (reduces initial bundle size)
export {
  DynamicReleasesTrendChart,
  DynamicGenreDistributionChart,
  DynamicYearlyStatsChart,
  DynamicMakerShareChart,
  DynamicGenreTrendChart,
  DynamicDebutTrendChart,
} from './DynamicCharts';
