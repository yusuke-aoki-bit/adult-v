'use client';

import { useMemo } from 'react';
import { useRouter, useSearchParams, usePathname, useParams } from 'next/navigation';
import type { SortOption } from '@/lib/db/queries';
import { providerMeta } from '@/lib/providers';

// Client-side translations (outside NextIntlClientProvider)
const translations = {
  ja: {
    filter: 'フィルター',
    clear: 'クリア',
    sort: '並び替え',
    releaseDateDesc: 'リリース日（新しい順）',
    releaseDateAsc: 'リリース日（古い順）',
    priceDesc: '価格（高い順）',
    priceAsc: '価格（安い順）',
    ratingDesc: '評価（高い順）',
    ratingAsc: '評価（低い順）',
    titleAsc: 'タイトル（あいうえお順）',
    distributionService: '配信サービス',
    priceRange: '価格帯',
    priceAbove: '以上',
  },
  en: {
    filter: 'Filter',
    clear: 'Clear',
    sort: 'Sort',
    releaseDateDesc: 'Release Date (Newest)',
    releaseDateAsc: 'Release Date (Oldest)',
    priceDesc: 'Price (High to Low)',
    priceAsc: 'Price (Low to High)',
    ratingDesc: 'Rating (High to Low)',
    ratingAsc: 'Rating (Low to High)',
    titleAsc: 'Title (A-Z)',
    distributionService: 'Distribution Service',
    priceRange: 'Price Range',
    priceAbove: 'and above',
  },
  zh: {
    filter: '筛选',
    clear: '清除',
    sort: '排序',
    releaseDateDesc: '发布日期（最新）',
    releaseDateAsc: '发布日期（最早）',
    priceDesc: '价格（从高到低）',
    priceAsc: '价格（从低到高）',
    ratingDesc: '评分（从高到低）',
    ratingAsc: '评分（从低到高）',
    titleAsc: '标题（A-Z）',
    distributionService: '分发服务',
    priceRange: '价格范围',
    priceAbove: '以上',
  },
  ko: {
    filter: '필터',
    clear: '지우기',
    sort: '정렬',
    releaseDateDesc: '출시일 (최신순)',
    releaseDateAsc: '출시일 (오래된순)',
    priceDesc: '가격 (높은순)',
    priceAsc: '가격 (낮은순)',
    ratingDesc: '평점 (높은순)',
    ratingAsc: '평점 (낮은순)',
    titleAsc: '제목 (가나다순)',
    distributionService: '배포 서비스',
    priceRange: '가격대',
    priceAbove: '이상',
  },
} as const;

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
  const params = useParams();
  const locale = (params?.locale as string) || 'ja';
  const t = translations[locale as keyof typeof translations] || translations.ja;

  // URLパラメータから直接計算（stateを使わない）
  const sortBy = useMemo<SortOption>(() => {
    return (searchParams.get('sort') as SortOption) || defaultSort;
  }, [searchParams, defaultSort]);

  const selectedProviders = useMemo<Set<string>>(() => {
    const providerParam = searchParams.get('provider');
    return providerParam ? new Set(providerParam.split(',')) : new Set<string>();
  }, [searchParams]);

  const selectedPriceRanges = useMemo<Set<string>>(() => {
    const priceParam = searchParams.get('priceRange');
    return priceParam ? new Set(priceParam.split(',')) : new Set<string>();
  }, [searchParams]);

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
    applyFilters(sortBy, selectedProviders, newRanges);
  };

  // ソート変更
  const handleSortChange = (newSort: SortOption) => {
    applyFilters(newSort, selectedProviders, selectedPriceRanges);
  };

  // 全クリア
  const clearAllFilters = () => {
    router.push(pathname);
  };

  const hasActiveFilters = selectedProviders.size > 0 || selectedPriceRanges.size > 0 || sortBy !== defaultSort;

  // Memoize sort options to prevent recreation on every render
  const sortOptions = useMemo<{ value: SortOption; label: string }[]>(() => [
    { value: 'releaseDateDesc', label: t.releaseDateDesc },
    { value: 'releaseDateAsc', label: t.releaseDateAsc },
    { value: 'priceDesc', label: t.priceDesc },
    { value: 'priceAsc', label: t.priceAsc },
    { value: 'ratingDesc', label: t.ratingDesc },
    { value: 'ratingAsc', label: t.ratingAsc },
    { value: 'titleAsc', label: t.titleAsc },
  ], [t]);

  // Memoize price ranges to prevent recreation on every render
  const priceRanges = useMemo<{ value: string; label: string }[]>(() => [
    { value: '0-1000', label: '¥0 - ¥1,000' },
    { value: '1000-2000', label: '¥1,000 - ¥2,000' },
    { value: '2000-3000', label: '¥2,000 - ¥3,000' },
    { value: '3000', label: `¥3,000${t.priceAbove}` },
  ], [t.priceAbove]);

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
      {/* ヘッダー：クリアボタン */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-semibold text-gray-700">{t.filter}</h3>
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="text-sm text-pink-600 hover:text-pink-800 font-medium flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            {t.clear}
          </button>
        )}
      </div>

      <div className="space-y-4">
        {/* ソート */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-2">
            {t.sort}
          </label>
          <select
            value={sortBy}
            onChange={(e) => handleSortChange(e.target.value as SortOption)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
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
              {t.distributionService}
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
                        ? 'bg-pink-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-pink-50'
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
                      <span className={`${isSelected ? 'text-pink-200' : 'text-gray-400'}`}>
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
              {t.priceRange}
            </label>
            <div className="flex flex-wrap gap-2">
              {priceRanges.map((range) => {
                const isSelected = selectedPriceRanges.has(range.value);
                return (
                  <label
                    key={range.value}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-pink-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-pink-50'
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

