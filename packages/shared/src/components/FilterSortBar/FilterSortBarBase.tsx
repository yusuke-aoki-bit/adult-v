'use client';

import { useMemo, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname, useParams } from 'next/navigation';
import { providerMeta, type ProviderId } from '../../lib/providers';
import { ASP_DISPLAY_ORDER, ASP_TO_PROVIDER_ID } from '../../constants/filters';

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

export type SortOption =
  | 'releaseDateDesc'
  | 'releaseDateAsc'
  | 'priceDesc'
  | 'priceAsc'
  | 'ratingDesc'
  | 'ratingAsc'
  | 'titleAsc';

export type FilterSortBarTheme = 'dark' | 'light';

export interface FilterSortBarBaseProps {
  /** Theme: 'dark' for adult-v, 'light' for fanza */
  theme: FilterSortBarTheme;
  defaultSort?: SortOption;
  showProviderFilter?: boolean;
  showPriceFilter?: boolean;
  providerCounts?: Record<string, number>;
}

interface ThemeConfig {
  container: string;
  header: string;
  label: string;
  clearButton: string;
  select: string;
  providerUnselected: string;
  priceUnselected: string;
  priceSelected: string;
}

const themeConfigs: Record<FilterSortBarTheme, ThemeConfig> = {
  dark: {
    container: 'bg-white rounded-2xl shadow-lg p-6 mb-6',
    header: 'text-sm font-semibold text-gray-700',
    label: 'block text-xs font-medium text-gray-500 mb-2',
    clearButton: 'text-sm text-rose-600 hover:text-rose-800 font-medium flex items-center gap-1',
    select: 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent',
    providerUnselected: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
    priceUnselected: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
    priceSelected: 'bg-gray-900 text-white',
  },
  light: {
    container: 'bg-white rounded-2xl shadow-lg p-6 mb-6',
    header: 'text-sm font-semibold text-gray-700',
    label: 'block text-xs font-medium text-gray-500 mb-2',
    clearButton: 'text-sm text-pink-600 hover:text-pink-800 font-medium flex items-center gap-1',
    select: 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent',
    providerUnselected: 'bg-gray-100 text-gray-700 hover:bg-pink-50',
    priceUnselected: 'bg-gray-100 text-gray-700 hover:bg-pink-50',
    priceSelected: 'bg-pink-500 text-white',
  },
};

export default function FilterSortBarBase({
  theme,
  defaultSort = 'releaseDateDesc',
  showProviderFilter = true,
  showPriceFilter = true,
  providerCounts = {},
}: FilterSortBarBaseProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = useParams();
  const locale = (params?.locale as string) || 'ja';
  const t = translations[locale as keyof typeof translations] || translations.ja;
  const config = themeConfigs[theme];

  // URLパラメータから直接計算（stateを使わない）
  const sortBy = useMemo<SortOption>(() => {
    return (searchParams.get('sort') as SortOption) || defaultSort;
  }, [searchParams, defaultSort]);

  const selectedProviders = useMemo<Set<string>>(() => {
    // includeAspパラメータを優先、後方互換でproviderもサポート
    const includeAspParam = searchParams.get('includeAsp');
    const providerParam = searchParams.get('provider');
    const param = includeAspParam || providerParam;
    return param ? new Set(param.split(',')) : new Set<string>();
  }, [searchParams]);

  const selectedPriceRanges = useMemo<Set<string>>(() => {
    const priceParam = searchParams.get('priceRange');
    return priceParam ? new Set(priceParam.split(',')) : new Set<string>();
  }, [searchParams]);

  // フィルター適用（即時実行）
  const applyFilters = useCallback((
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

    // プロバイダー（includeAspパラメータを使用、ヘッダーと統一）
    params.delete('provider'); // 古いパラメータは削除
    if (providers.size === 0) {
      params.delete('includeAsp');
    } else {
      params.set('includeAsp', Array.from(providers).join(','));
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
  }, [searchParams, defaultSort, router, pathname]);

  // プロバイダーチェック切り替え
  const toggleProvider = useCallback((providerId: string) => {
    const newProviders = new Set(selectedProviders);
    if (newProviders.has(providerId)) {
      newProviders.delete(providerId);
    } else {
      newProviders.add(providerId);
    }
    applyFilters(sortBy, newProviders, selectedPriceRanges);
  }, [selectedProviders, selectedPriceRanges, sortBy, applyFilters]);

  // 価格帯チェック切り替え
  const togglePriceRange = useCallback((range: string) => {
    const newRanges = new Set(selectedPriceRanges);
    if (newRanges.has(range)) {
      newRanges.delete(range);
    } else {
      newRanges.add(range);
    }
    applyFilters(sortBy, selectedProviders, newRanges);
  }, [selectedPriceRanges, selectedProviders, sortBy, applyFilters]);

  // ソート変更
  const handleSortChange = useCallback((newSort: SortOption) => {
    applyFilters(newSort, selectedProviders, selectedPriceRanges);
  }, [selectedProviders, selectedPriceRanges, applyFilters]);

  // 全クリア
  const clearAllFilters = useCallback(() => {
    router.push(pathname);
  }, [router, pathname]);

  // Memoize hasActiveFilters to prevent recalculation
  const hasActiveFilters = useMemo(() =>
    selectedProviders.size > 0 || selectedPriceRanges.size > 0 || sortBy !== defaultSort
  , [selectedProviders, selectedPriceRanges, sortBy, defaultSort]);

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
    <div className={config.container}>
      {/* ヘッダー：クリアボタン */}
      <div className="flex justify-between items-center mb-4">
        <h3 className={config.header}>{t.filter}</h3>
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className={config.clearButton}
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
          <label className={config.label}>
            {t.sort}
          </label>
          <select
            value={sortBy}
            onChange={(e) => handleSortChange(e.target.value as SortOption)}
            className={config.select}
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* プロバイダーフィルター（チェックボックス） - ASP_DISPLAY_ORDER順、ヘッダーと同じaspNameを使用 */}
        {showProviderFilter && (
          <div>
            <label className={config.label}>
              {t.distributionService}
            </label>
            <div className="flex flex-wrap gap-2">
              {ASP_DISPLAY_ORDER.map((aspName) => {
                const providerId = ASP_TO_PROVIDER_ID[aspName];
                if (!providerId) return null;
                const meta = providerMeta[providerId as ProviderId];
                if (!meta) return null;
                const count = providerCounts[providerId] ?? providerCounts[aspName];
                // ヘッダーと同じくaspNameで選択状態を管理
                const isSelected = selectedProviders.has(aspName);
                return (
                  <label
                    key={aspName}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all text-white hover:opacity-90 ${
                      isSelected ? 'ring-2 ring-white ring-offset-1 shadow-md' : ''
                    }`}
                    style={meta.gradientColors ? {
                      background: `linear-gradient(to right, ${meta.gradientColors.from}, ${meta.gradientColors.to})`,
                    } : undefined}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleProvider(aspName)}
                      className="sr-only"
                    />
                    {isSelected && (
                      <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                    {meta.label}
                    {count !== undefined && (
                      <span className="text-white/80">
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
            <label className={config.label}>
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
                        ? config.priceSelected
                        : config.priceUnselected
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
