/**
 * Shared section component theme definitions
 * Each app can provide either 'dark' or 'light' theme
 */

export type SectionTheme = 'dark' | 'light';

export interface ThemeConfig {
  // RecentlyViewed
  recentlyViewed: {
    iconColorClass: string;
    bgClass: string;
    deleteButtonBgClass: string;
  };
  // ForYouRecommendations
  forYouRecommendations: {
    iconColorClass: string;
    bgClass: string;
    subtitleClass: string;
  };
  // SalesSection
  salesSection: {
    iconColorClass: string;
    bgClass: string;
    linkColorClass: string;
  };
  // WeeklyHighlights
  weeklyHighlights: {
    containerClass: string;
    iconBgClass: string;
    iconColorClass: string;
    titleClass: string;
    subtitleClass: string;
    chevronClass: string;
    skeletonBgClass: string;
    cardBgClass: string;
    trendingTitleClass: string;
    hotTitleClass: string;
    classicTitleClass: string;
    cardTextClass: string;
    cardHoverTextClass: string;
  };
}

export const darkTheme: ThemeConfig = {
  recentlyViewed: {
    iconColorClass: 'text-blue-400',
    bgClass: 'bg-gray-900/50',
    deleteButtonBgClass: 'bg-gray-900/80',
  },
  forYouRecommendations: {
    iconColorClass: 'text-purple-400',
    bgClass: 'bg-gradient-to-r from-purple-900/30 to-pink-900/30',
    subtitleClass: 'text-gray-400',
  },
  salesSection: {
    iconColorClass: 'text-red-400',
    bgClass: 'bg-gradient-to-r from-red-900/30 to-orange-900/30',
    linkColorClass: 'text-rose-400 hover:text-rose-300',
  },
  weeklyHighlights: {
    containerClass: 'bg-gradient-to-r from-amber-900/30 to-orange-900/30 rounded-xl p-4 sm:p-6 border border-amber-500/20',
    iconBgClass: 'bg-amber-500/20',
    iconColorClass: 'text-amber-400',
    titleClass: 'text-white',
    subtitleClass: 'text-gray-400',
    chevronClass: 'text-gray-400',
    skeletonBgClass: 'bg-gray-700',
    cardBgClass: 'bg-gray-800/50',
    trendingTitleClass: 'text-amber-400',
    hotTitleClass: 'text-orange-400',
    classicTitleClass: 'text-rose-400',
    cardTextClass: 'text-white',
    cardHoverTextClass: 'group-hover:text-amber-300',
  },
};

export const lightTheme: ThemeConfig = {
  recentlyViewed: {
    iconColorClass: 'text-blue-500',
    bgClass: 'bg-gray-50',
    deleteButtonBgClass: 'bg-gray-700/80',
  },
  forYouRecommendations: {
    iconColorClass: 'text-purple-500',
    bgClass: 'bg-gradient-to-r from-purple-50 to-pink-50',
    subtitleClass: 'text-gray-500',
  },
  salesSection: {
    iconColorClass: 'text-red-500',
    bgClass: 'bg-gradient-to-r from-red-50 to-orange-50',
    linkColorClass: 'text-rose-600 hover:text-rose-500',
  },
  weeklyHighlights: {
    containerClass: 'bg-gradient-to-r from-amber-100 to-orange-100 rounded-xl p-4 sm:p-6 border border-amber-300/50',
    iconBgClass: 'bg-amber-500/20',
    iconColorClass: 'text-amber-600',
    titleClass: 'text-gray-800',
    subtitleClass: 'text-gray-500',
    chevronClass: 'text-gray-500',
    skeletonBgClass: 'bg-gray-200',
    cardBgClass: 'bg-white border border-gray-200 shadow-sm',
    trendingTitleClass: 'text-amber-700',
    hotTitleClass: 'text-orange-700',
    classicTitleClass: 'text-rose-700',
    cardTextClass: 'text-gray-800',
    cardHoverTextClass: 'group-hover:text-amber-600',
  },
};

export function getThemeConfig(theme: SectionTheme): ThemeConfig {
  return theme === 'dark' ? darkTheme : lightTheme;
}
