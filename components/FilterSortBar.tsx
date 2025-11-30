'use client';

import { useState, useEffect } from 'react';
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
  const [selectedProviders, setSelectedProviders] = useState<Set<string>>(() => {
    const providerParam = searchParams.get('provider');
    return providerParam ? new Set(providerParam.split(',')) : new Set<string>();
  });
  const [selectedPriceRanges, setSelectedPriceRanges] = useState<Set<string>>(() => {
    const priceParam = searchParams.get('priceRange');
    return priceParam ? new Set(priceParam.split(',')) : new Set<string>();
  });

  // URLパラメータの変更を監視
  useEffect(() => {
    const providerParam = searchParams.get('provider');
    const priceParam = searchParams.get('priceRange');
    const sortParam = searchParams.get('sort') as SortOption;

    setSelectedProviders(providerParam ? new Set(providerParam.split(',')) : new Set<string>());
    setSelectedPriceRanges(priceParam ? new Set(priceParam.split(',')) : new Set<string>());
    setSortBy(sortParam || defaultSort);
  }, [searchParams, defaultSort]);

  // フィルター適用（即時実行）
  const applyFilters = (
    newSort: SortOption,
    providers: Set<string>,
    priceRanges: Set<string>
  ): void => {
    const params = new URLSearchParams(searchParams.toString());

    // ソート
    if (newSort === defaultSort) {
      params.delete('sort');
    } else {
      params.set('sort', newSort);
    }

    // プロバイダー
    if (providers.size === 0) {
      params.delete('provider');
    } else {
      params.set('provider', Array.from(providers).join(','));
    }

    // 価格帯
    if (priceRanges.size === 0) {
      params.delete('priceRange');
    } else {
      params.set('priceRange', Array.from(priceRanges).join(','));
    }

    params.delete('page');

    const queryString = params.toString();
    router.push(`${pathname}${queryString ? `?${queryString}` : ''}`);
  };

  // プロバイダーチェック切り替え
  const toggleProvider = (providerId: string) => {
    const newProviders = new Set(selectedProviders);
    if (newProviders.has(providerId)) {
      newProviders.delete(providerId);
    } else {
      newProviders.add(providerId);
    }
    setSelectedProviders(newProviders);
    applyFilters(sortBy, newProviders, selectedPriceRanges);
  };

  // 価格帯チェック切り替え
  const togglePriceRange = (range: string) => {
    const newRanges = new Set(selectedPriceRanges);
    if (newRanges.has(range)) {
      newRanges.delete(range);
    } else {
      newRanges.add(range);
    }
    setSelectedPriceRanges(newRanges);
    applyFilters(sortBy, selectedProviders, newRanges);
  };

  // ソート変更
  const handleSortChange = (newSort: SortOption) => {
    setSortBy(newSort);
    applyFilters(newSort, selectedProviders, selectedPriceRanges);
  };

  // 全クリア
  const clearAllFilters = () => {
    setSelectedProviders(new Set());
    setSelectedPriceRanges(new Set());
    setSortBy(defaultSort);
    router.push(pathname);
  };

  const hasActiveFilters = selectedProviders.size > 0 || selectedPriceRanges.size > 0 || sortBy !== defaultSort;

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
    { value: '0-1000', label: '¥0 - ¥1,000' },
    { value: '1000-2000', label: '¥1,000 - ¥2,000' },
    { value: '2000-3000', label: '¥2,000 - ¥3,000' },
    { value: '3000', label: '¥3,000以上' },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
      {/* ヘッダー：クリアボタン */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-semibold text-gray-700">フィルター</h3>
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="text-sm text-rose-600 hover:text-rose-800 font-medium flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            クリア
          </button>
        )}
      </div>

      <div className="space-y-4">
        {/* ソート */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-2">
            並び替え
          </label>
          <select
            value={sortBy}
            onChange={(e) => handleSortChange(e.target.value as SortOption)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* プロバイダーフィルター（チェックボックス） */}
        {showProviderFilter && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">
              配信サービス
            </label>
            <div className="flex flex-wrap gap-2">
              {Object.values(providerMeta).map((p) => {
                const count = providerCounts[p.id];
                const isSelected = selectedProviders.has(p.id);
                return (
                  <label
                    key={p.id}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleProvider(p.id)}
                      className="sr-only"
                    />
                    {p.label}
                    {count !== undefined && (
                      <span className={`${isSelected ? 'text-gray-300' : 'text-gray-400'}`}>
                        ({count.toLocaleString()})
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* 価格フィルター（チェックボックス） */}
        {showPriceFilter && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">
              価格帯
            </label>
            <div className="flex flex-wrap gap-2">
              {priceRanges.map((range) => {
                const isSelected = selectedPriceRanges.has(range.value);
                return (
                  <label
                    key={range.value}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => togglePriceRange(range.value)}
                      className="sr-only"
                    />
                    {range.label}
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

