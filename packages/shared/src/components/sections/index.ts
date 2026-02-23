// Section components
export { RecentlyViewedSection } from './RecentlyViewedSection';
export { ForYouRecommendationsSection } from './ForYouRecommendationsSection';
export { SalesSectionBase } from './SalesSectionBase';
export { WeeklyHighlightsSection } from './WeeklyHighlightsSection';

// Theme utilities
export { getThemeConfig, darkTheme, lightTheme } from './theme';
export type { SectionTheme, ThemeConfig } from './theme';

// Translations
export {
  recentlyViewedTranslations,
  forYouTranslations,
  salesTranslations,
  weeklyHighlightsTranslations,
  productDetailTranslations,
  getTranslation,
} from '../../lib/translations';
export type { Locale } from '../../lib/translations';
