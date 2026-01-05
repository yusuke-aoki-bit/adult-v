// Filter components
export { default as ProductSortDropdown } from './ProductSortDropdown';
export { default as PerPageDropdown } from './PerPageDropdown';
export { default as ActiveFiltersChips } from './ActiveFiltersChips';

// Theme and translations
export { getFilterThemeConfig, darkFilterTheme, lightFilterTheme } from './theme';
export type { FilterTheme, FilterThemeConfig } from './theme';

export {
  sortTranslations,
  perPageTranslations,
  activeFiltersTranslations,
  getSortTranslation,
  getPerPageTranslation,
  getActiveFiltersTranslation,
} from './translations';
export type { SortTranslationKey, PerPageTranslationKey, ActiveFiltersTranslationKey, SupportedLocale } from './translations';
