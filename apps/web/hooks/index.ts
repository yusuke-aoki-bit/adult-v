// Re-export all hooks from @adult-v/shared
export {
  useBudget,
  useBudgetTracker,
  useDebounce,
  useDiscoveryBadge,
  useFavorites,
  useInfiniteScroll,
  usePreferenceAnalysis,
  useRecentlyViewed,
  useSceneInfo,
  useViewingDiary,
  useWatchlistAnalysis,
  profileTranslations,
} from '@adult-v/shared/hooks';

export type {
  BudgetSettings,
  FavoriteItem,
  PreferenceAnalysis,
} from '@adult-v/shared/hooks';
