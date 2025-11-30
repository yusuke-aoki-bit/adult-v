'use client';

import { useState } from 'react';
import { Calendar, Filter, X } from 'lucide-react';

export interface SearchFilterOptions {
  query?: string;
  providers?: string[];
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'relevance' | 'date_desc' | 'date_asc' | 'views_desc';
  hasVideo?: boolean;
  hasImage?: boolean;
}

interface SearchFiltersProps {
  onFilterChange: (filters: SearchFilterOptions) => void;
  initialFilters?: SearchFilterOptions;
}

const PROVIDERS = [
  { value: 'DUGA', label: 'DUGA' },
  { value: 'MGS', label: 'MGS' },
  { value: 'ソクミル', label: 'ソクミル' },
  { value: '一本道', label: '一本道' },
  { value: 'カリビアンコム', label: 'カリビアンコム' },
  { value: 'HEYZO', label: 'HEYZO' },
  { value: 'B10F.jp', label: 'B10F.jp' },
];

const SORT_OPTIONS = [
  { value: 'relevance', label: '関連度順' },
  { value: 'date_desc', label: '新着順' },
  { value: 'date_asc', label: '古い順' },
  { value: 'views_desc', label: '人気順' },
];

export default function SearchFilters({ onFilterChange, initialFilters = {} }: SearchFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState<SearchFilterOptions>(initialFilters);

  const handleFilterChange = (key: keyof SearchFilterOptions, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleProviderToggle = (provider: string) => {
    const currentProviders = filters.providers || [];
    const newProviders = currentProviders.includes(provider)
      ? currentProviders.filter((p) => p !== provider)
      : [...currentProviders, provider];

    handleFilterChange('providers', newProviders.length > 0 ? newProviders : undefined);
  };

  const clearFilters = () => {
    const clearedFilters: SearchFilterOptions = {
      query: filters.query,
    };
    setFilters(clearedFilters);
    onFilterChange(clearedFilters);
  };

  const activeFilterCount = Object.keys(filters).filter(
    (key) => key !== 'query' && filters[key as keyof SearchFilterOptions] !== undefined
  ).length;

  return (
    <div className="bg-gray-800 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 text-white hover:text-rose-500 transition-colors"
        >
          <Filter className="h-5 w-5" />
          <span className="font-medium">
            フィルター
            {activeFilterCount > 0 && (
              <span className="ml-2 bg-rose-600 text-white text-xs px-2 py-0.5 rounded-full">
                {activeFilterCount}
              </span>
            )}
          </span>
        </button>

        {activeFilterCount > 0 && (
          <button
            onClick={clearFilters}
            className="text-sm text-gray-400 hover:text-white flex items-center gap-1"
          >
            <X className="h-4 w-4" />
            クリア
          </button>
        )}
      </div>

      {isOpen && (
        <div className="space-y-4 pt-4 border-t border-gray-700">
          {/* Sort By */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              並び替え
            </label>
            <select
              value={filters.sortBy || 'relevance'}
              onChange={(e) => handleFilterChange('sortBy', e.target.value)}
              className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-rose-500 outline-none"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Providers */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              配信元
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PROVIDERS.map((provider) => (
                <button
                  key={provider.value}
                  onClick={() => handleProviderToggle(provider.value)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filters.providers?.includes(provider.value)
                      ? 'bg-rose-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {provider.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              発売日
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <input
                  type="date"
                  value={filters.dateFrom || ''}
                  onChange={(e) => handleFilterChange('dateFrom', e.target.value || undefined)}
                  className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-rose-500 outline-none text-sm"
                  placeholder="開始日"
                />
              </div>
              <div>
                <input
                  type="date"
                  value={filters.dateTo || ''}
                  onChange={(e) => handleFilterChange('dateTo', e.target.value || undefined)}
                  className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-rose-500 outline-none text-sm"
                  placeholder="終了日"
                />
              </div>
            </div>
          </div>

          {/* Boolean Filters */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.hasVideo || false}
                onChange={(e) => handleFilterChange('hasVideo', e.target.checked || undefined)}
                className="w-4 h-4 text-rose-600 bg-gray-700 border-gray-600 rounded focus:ring-rose-500"
              />
              <span>サンプル動画あり</span>
            </label>

            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.hasImage || false}
                onChange={(e) => handleFilterChange('hasImage', e.target.checked || undefined)}
                className="w-4 h-4 text-rose-600 bg-gray-700 border-gray-600 rounded focus:ring-rose-500"
              />
              <span>サンプル画像あり</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
