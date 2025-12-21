'use client';

import { memo } from 'react';
import { SearchFiltersBase, SearchFiltersTheme } from '@adult-v/shared/components';
import { useSite } from '@/lib/contexts/SiteContext';

// Re-export type for consumers
export type { SearchFilterOptions } from '@adult-v/shared/components';

interface SearchFiltersProps {
  onFilterChange: (filters: import('@adult-v/shared/components').SearchFilterOptions) => void;
  initialFilters?: import('@adult-v/shared/components').SearchFilterOptions;
}

// Dark theme for web app (static, defined outside component)
const darkTheme: SearchFiltersTheme = {
  container: 'bg-gray-800 rounded-lg p-4 mb-6',
  button: 'text-white',
  buttonHover: 'hover:text-rose-500',
  badge: 'bg-rose-600 text-white',
  clearButton: 'text-gray-400',
  clearButtonHover: 'hover:text-white',
  border: 'border-gray-700',
  label: 'text-gray-300',
  select: 'bg-gray-700 text-white',
  selectFocus: 'focus:ring-2 focus:ring-rose-500',
  providerActive: 'bg-rose-600 text-white',
  providerInactive: 'bg-gray-700 text-gray-300',
  providerInactiveHover: 'hover:bg-gray-600',
  dateInput: 'bg-gray-700 text-white',
  dateInputFocus: 'focus:ring-2 focus:ring-rose-500',
  checkbox: 'text-rose-600 bg-gray-700 border-gray-600 focus:ring-rose-500',
  checkboxLabel: 'text-gray-300',
};

const SearchFilters = memo(function SearchFilters({
  onFilterChange,
  initialFilters = {},
}: SearchFiltersProps) {
  const { isFanzaSite } = useSite();

  return (
    <SearchFiltersBase
      onFilterChange={onFilterChange}
      initialFilters={initialFilters}
      theme={darkTheme}
      isFanzaSite={isFanzaSite}
    />
  );
});

export default SearchFilters;
