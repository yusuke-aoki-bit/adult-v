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

// Light theme for fanza app (static, defined outside component)
const lightTheme: SearchFiltersTheme = {
  container: 'bg-white rounded-lg p-4 mb-6 border border-gray-200 shadow-sm',
  button: 'text-gray-800',
  buttonHover: 'hover:text-rose-700',
  badge: 'bg-rose-700 text-white',
  clearButton: 'text-gray-500',
  clearButtonHover: 'hover:text-gray-800',
  border: 'border-gray-200',
  label: 'text-gray-700',
  select: 'bg-white text-gray-800 border border-gray-300',
  selectFocus: 'focus:ring-2 focus:ring-rose-700',
  providerActive: 'bg-rose-700 text-white',
  providerInactive: 'bg-gray-100 text-gray-700',
  providerInactiveHover: 'hover:bg-gray-200',
  dateInput: 'bg-white text-gray-800 border border-gray-300',
  dateInputFocus: 'focus:ring-2 focus:ring-rose-700',
  checkbox: 'text-rose-700 bg-white border-gray-300 focus:ring-rose-700',
  checkboxLabel: 'text-gray-700',
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
      theme={lightTheme}
      isFanzaSite={isFanzaSite}
    />
  );
});

export default SearchFilters;
