'use client';

import { useState, useCallback, memo } from 'react';
import { Calendar, Filter, X } from 'lucide-react';
import { providerMeta } from '../../lib/providers';
import { ASP_TO_PROVIDER_ID } from '../../constants/filters';

export interface SearchFilterOptions {
  query?: string;
  providers?: string[];
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'relevance' | 'date_desc' | 'date_asc' | 'views_desc';
  hasVideo?: boolean;
  hasImage?: boolean;
}

export interface SearchFiltersTheme {
  container: string;
  button: string;
  buttonHover: string;
  badge: string;
  clearButton: string;
  clearButtonHover: string;
  border: string;
  label: string;
  select: string;
  selectFocus: string;
  providerActive: string;
  providerInactive: string;
  providerInactiveHover: string;
  dateInput: string;
  dateInputFocus: string;
  checkbox: string;
  checkboxLabel: string;
}

export interface SearchFiltersBaseProps {
  onFilterChange: (filters: SearchFilterOptions) => void;
  initialFilters?: SearchFilterOptions;
  theme: SearchFiltersTheme;
  isFanzaSite?: boolean;
}

export const PROVIDERS = [
  { value: 'DUGA', label: 'DUGA' },
  { value: 'MGS', label: 'MGS' },
  { value: 'ソクミル', label: 'ソクミル' },
  { value: '一本道', label: '一本道' },
  { value: 'カリビアンコム', label: 'カリビアンコム' },
  { value: 'HEYZO', label: 'HEYZO' },
  { value: 'B10F.jp', label: 'B10F.jp' },
];

export const SORT_OPTIONS = [
  { value: 'relevance', label: '関連度順' },
  { value: 'date_desc', label: '新着順' },
  { value: 'date_asc', label: '古い順' },
  { value: 'views_desc', label: '人気順' },
];

export const searchFiltersTranslations = {
  ja: {
    filter: 'フィルター',
    clear: 'クリア',
    sortBy: '並び替え',
    providers: '配信元',
    releaseDate: '発売日',
    hasVideo: 'サンプル動画あり',
    hasImage: 'サンプル画像あり',
  },
  en: {
    filter: 'Filters',
    clear: 'Clear',
    sortBy: 'Sort by',
    providers: 'Providers',
    releaseDate: 'Release Date',
    hasVideo: 'Has sample video',
    hasImage: 'Has sample images',
  },
  zh: {
    filter: '筛选',
    clear: '清除',
    sortBy: '排序',
    providers: '来源',
    releaseDate: '发行日期',
    hasVideo: '有样品视频',
    hasImage: '有样品图片',
  },
  ko: {
    filter: '필터',
    clear: '지우기',
    sortBy: '정렬',
    providers: '제공자',
    releaseDate: '발매일',
    hasVideo: '샘플 동영상 있음',
    hasImage: '샘플 이미지 있음',
  },
} as const;

export const SearchFiltersBase = memo(function SearchFiltersBase({
  onFilterChange,
  initialFilters = {},
  theme,
  isFanzaSite = false,
}: SearchFiltersBaseProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState<SearchFilterOptions>(initialFilters);

  const handleFilterChange = useCallback((key: keyof SearchFilterOptions, value: SearchFilterOptions[keyof SearchFilterOptions]) => {
    setFilters(prev => {
      const newFilters = { ...prev, [key]: value };
      onFilterChange(newFilters);
      return newFilters;
    });
  }, [onFilterChange]);

  const handleProviderToggle = useCallback((provider: string) => {
    setFilters(prev => {
      const currentProviders = prev.providers || [];
      const newProviders = currentProviders.includes(provider)
        ? currentProviders.filter((p) => p !== provider)
        : [...currentProviders, provider];
      const newFilters = { ...prev, providers: newProviders.length > 0 ? newProviders : undefined };
      onFilterChange(newFilters);
      return newFilters;
    });
  }, [onFilterChange]);

  const clearFilters = useCallback(() => {
    setFilters(prev => {
      const clearedFilters: SearchFilterOptions = {
        query: prev.query,
      };
      onFilterChange(clearedFilters);
      return clearedFilters;
    });
  }, [onFilterChange]);

  const activeFilterCount = Object.keys(filters).filter(
    (key) => key !== 'query' && filters[key as keyof SearchFilterOptions] !== undefined
  ).length;

  return (
    <div className={theme.container}>
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-2 ${theme.button} ${theme.buttonHover} transition-colors`}
        >
          <Filter className="h-5 w-5" />
          <span className="font-medium">
            フィルター
            {activeFilterCount > 0 && (
              <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${theme.badge}`}>
                {activeFilterCount}
              </span>
            )}
          </span>
        </button>

        {activeFilterCount > 0 && (
          <button
            onClick={clearFilters}
            className={`text-sm ${theme.clearButton} ${theme.clearButtonHover} flex items-center gap-1`}
          >
            <X className="h-4 w-4" />
            クリア
          </button>
        )}
      </div>

      {isOpen && (
        <div className={`space-y-4 pt-4 border-t ${theme.border}`}>
          {/* Sort By */}
          <div>
            <label className={`block text-sm font-medium ${theme.label} mb-2`}>
              並び替え
            </label>
            <select
              value={filters.sortBy || 'relevance'}
              onChange={(e) => handleFilterChange('sortBy', e.target.value)}
              className={`w-full rounded-lg px-3 py-2 outline-none ${theme.select} ${theme.selectFocus}`}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Providers - FANZAサイトでは非表示 */}
          {!isFanzaSite && (
            <div>
              <label className={`block text-sm font-medium ${theme.label} mb-2`}>
                配信元
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {PROVIDERS.map((provider) => {
                  const providerId = ASP_TO_PROVIDER_ID[provider.value.toLowerCase()];
                  const meta = providerId ? providerMeta[providerId] : null;
                  const isSelected = filters.providers?.includes(provider.value);
                  const gradientStyle = isSelected && meta?.gradientColors
                    ? { background: `linear-gradient(to right, ${meta.gradientColors.from}, ${meta.gradientColors.to})` }
                    : undefined;
                  return (
                    <button
                      key={provider.value}
                      onClick={() => handleProviderToggle(provider.value)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isSelected
                          ? 'text-white'
                          : `${theme.providerInactive} ${theme.providerInactiveHover}`
                      }`}
                      style={gradientStyle}
                    >
                      {meta?.label || provider.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Date Range */}
          <div>
            <label className={`block text-sm font-medium ${theme.label} mb-2 flex items-center gap-2`}>
              <Calendar className="h-4 w-4" />
              発売日
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <input
                  type="date"
                  value={filters.dateFrom || ''}
                  onChange={(e) => handleFilterChange('dateFrom', e.target.value || undefined)}
                  className={`w-full rounded-lg px-3 py-2 outline-none text-sm ${theme.dateInput} ${theme.dateInputFocus}`}
                  placeholder="開始日"
                />
              </div>
              <div>
                <input
                  type="date"
                  value={filters.dateTo || ''}
                  onChange={(e) => handleFilterChange('dateTo', e.target.value || undefined)}
                  className={`w-full rounded-lg px-3 py-2 outline-none text-sm ${theme.dateInput} ${theme.dateInputFocus}`}
                  placeholder="終了日"
                />
              </div>
            </div>
          </div>

          {/* Boolean Filters */}
          <div className="space-y-2">
            <label className={`flex items-center gap-2 text-sm ${theme.checkboxLabel} cursor-pointer`}>
              <input
                type="checkbox"
                checked={filters.hasVideo || false}
                onChange={(e) => handleFilterChange('hasVideo', e.target.checked || undefined)}
                className={`w-4 h-4 rounded ${theme.checkbox}`}
              />
              <span>サンプル動画あり</span>
            </label>

            <label className={`flex items-center gap-2 text-sm ${theme.checkboxLabel} cursor-pointer`}>
              <input
                type="checkbox"
                checked={filters.hasImage || false}
                onChange={(e) => handleFilterChange('hasImage', e.target.checked || undefined)}
                className={`w-4 h-4 rounded ${theme.checkbox}`}
              />
              <span>サンプル画像あり</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
});
