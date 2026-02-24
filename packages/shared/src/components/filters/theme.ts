/**
 * Filter component theme definitions
 * Each app can provide either 'dark' or 'light' theme
 */

export type FilterTheme = 'dark' | 'light';

export interface FilterThemeConfig {
  // ProductSortDropdown
  sortDropdown: {
    labelClass: string;
    selectClass: string;
  };
  // ActiveFiltersChips
  activeFilters: {
    containerClass: string;
    labelClass: string;
    chipClass: string;
    clearAllClass: string;
  };
}

export const darkFilterTheme: FilterThemeConfig = {
  sortDropdown: {
    labelClass: 'text-sm font-medium text-gray-300',
    selectClass:
      'px-3 py-2 border border-gray-600 rounded-md text-sm text-white bg-gray-700 focus:ring-fuchsia-500 focus:border-fuchsia-500',
  },
  activeFilters: {
    containerClass:
      'flex flex-wrap items-center gap-2 py-2 px-3 mb-2 bg-gray-800/50 rounded-lg border-l-4 border-fuchsia-500 transition-all',
    labelClass: 'text-xs text-gray-300 font-medium',
    chipClass:
      'inline-flex items-center gap-1 bg-fuchsia-600/80 hover:bg-fuchsia-700 text-white text-xs px-2 py-1 rounded-full transition-colors group',
    clearAllClass: 'text-xs text-gray-400 hover:text-white underline transition-colors ml-1',
  },
};

export const lightFilterTheme: FilterThemeConfig = {
  sortDropdown: {
    labelClass: 'text-sm font-medium text-gray-600',
    selectClass:
      'px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:ring-pink-500 focus:border-pink-500',
  },
  activeFilters: {
    containerClass:
      'flex flex-wrap items-center gap-2 py-2 px-3 mb-2 bg-pink-50 rounded-lg border-l-4 border-pink-500 transition-all',
    labelClass: 'text-xs text-gray-600 font-medium',
    chipClass:
      'inline-flex items-center gap-1 bg-pink-500 hover:bg-pink-600 text-white text-xs px-2 py-1 rounded-full transition-colors group',
    clearAllClass: 'text-xs text-gray-500 hover:text-gray-700 underline transition-colors ml-1',
  },
};

export function getFilterThemeConfig(theme: FilterTheme): FilterThemeConfig {
  return theme === 'dark' ? darkFilterTheme : lightFilterTheme;
}
