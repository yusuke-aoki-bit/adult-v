'use client';

import { useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type { SortOption } from '@/lib/db/queries';
import { providerMeta } from '@/lib/providers';

interface FilterSortBarProps {
  defaultSort?: SortOption;
  showProviderFilter?: boolean;
  showPriceFilter?: boolean;
  providerCounts?: Record<string, number>;
}

export default function FilterSortBar({
  defaultSort = 'releaseDateDesc',
  showProviderFilter = true,
  showPriceFilter = true,
  providerCounts = {},
}: FilterSortBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const [sortBy, setSortBy] = useState<SortOption>(
    (searchParams.get('sort') as SortOption) || defaultSort
  );
  const [provider, setProvider] = useState<string>(
    searchParams.get('provider') || 'all'
  );
  const [priceRange, setPriceRange] = useState<string>(
    searchParams.get('priceRange') || 'all'
  );

  const updateFilters = (
    newSort?: SortOption,
    newProvider?: string,
    newPriceRange?: string
  ): void => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (newSort !== undefined) {
      if (newSort === defaultSort) {
        params.delete('sort');
      } else {
        params.set('sort', newSort);
      }
      setSortBy(newSort);
    }
    
    if (newProvider !== undefined) {
      if (newProvider === 'all') {
        params.delete('provider');
      } else {
        params.set('provider', newProvider);
      }
      setProvider(newProvider);
    }
    
    if (newPriceRange !== undefined) {
      if (newPriceRange === 'all') {
        params.delete('priceRange');
      } else {
        params.set('priceRange', newPriceRange);
      }
      setPriceRange(newPriceRange);
    }
    
    params.delete('page'); // フィルター変更時はページをリセット
    
    const queryString = params.toString();
    router.push(`${pathname}${queryString ? `?${queryString}` : ''}`);
  };

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: 'releaseDateDesc', label: 'リリース日（新しい順）' },
    { value: 'releaseDateAsc', label: 'リリース日（古い順）' },
    { value: 'priceDesc', label: '価格（高い順）' },
    { value: 'priceAsc', label: '価格（安い順）' },
    { value: 'ratingDesc', label: '評価（高い順）' },
    { value: 'ratingAsc', label: '評価（低い順）' },
    { value: 'titleAsc', label: 'タイトル（あいうえお順）' },
  ];

  const priceRanges: { value: string; label: string }[] = [
    { value: 'all', label: 'すべて' },
    { value: '0-1000', label: '¥0 - ¥1,000' },
    { value: '1000-2000', label: '¥1,000 - ¥2,000' },
    { value: '2000-3000', label: '¥2,000 - ¥3,000' },
    { value: '3000', label: '¥3,000以上' },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* ソート */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            並び替え
          </label>
          <select
            value={sortBy}
            onChange={(e) => updateFilters(e.target.value as SortOption)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* プロバイダーフィルター */}
        {showProviderFilter && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              配信サービス
            </label>
            <select
              value={provider}
              onChange={(e) => updateFilters(undefined, e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            >
              <option value="all">すべて</option>
              {Object.values(providerMeta).map((p) => {
                const count = providerCounts[p.id];
                return (
                  <option key={p.id} value={p.id}>
                    {p.label}{count !== undefined ? ` (${count.toLocaleString()})` : ''}
                  </option>
                );
              })}
            </select>
          </div>
        )}

        {/* 価格フィルター */}
        {showPriceFilter && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              価格帯
            </label>
            <select
              value={priceRange}
              onChange={(e) => updateFilters(undefined, undefined, e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            >
              {priceRanges.map((range) => (
                <option key={range.value} value={range.value}>
                  {range.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}

