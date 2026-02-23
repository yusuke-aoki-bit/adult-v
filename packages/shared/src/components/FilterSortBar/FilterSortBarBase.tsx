'use client';

import { useMemo, useCallback, useRef, useEffect, memo } from 'react';
import { useRouter, useSearchParams, usePathname, useParams } from 'next/navigation';
import { useSiteTheme } from '../../contexts/SiteThemeContext';
import { providerMeta, type ProviderId } from '../../lib/providers';
import { ASP_DISPLAY_ORDER, ASP_TO_PROVIDER_ID } from '../../constants/filters';
import { getTranslation, filterSortBarTranslations } from '../../lib/translations';

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
  /** Theme: auto-detected from SiteThemeContext if not provided */
  theme?: FilterSortBarTheme;
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
    select:
      'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent',
    providerUnselected: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
    priceUnselected: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
    priceSelected: 'bg-gray-900 text-white',
  },
  light: {
    container: 'bg-white rounded-2xl shadow-lg p-6 mb-6',
    header: 'text-sm font-semibold text-gray-700',
    label: 'block text-xs font-medium text-gray-500 mb-2',
    clearButton: 'text-sm text-pink-600 hover:text-pink-800 font-medium flex items-center gap-1',
    select:
      'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent',
    providerUnselected: 'bg-gray-100 text-gray-700 hover:bg-pink-50',
    priceUnselected: 'bg-gray-100 text-gray-700 hover:bg-pink-50',
    priceSelected: 'bg-pink-500 text-white',
  },
};

function FilterSortBarBase({
  theme: themeProp,
  defaultSort = 'releaseDateDesc',
  showProviderFilter = true,
  showPriceFilter = true,
  providerCounts = {},
}: FilterSortBarBaseProps) {
  const { theme: contextTheme } = useSiteTheme();
  const theme = themeProp ?? contextTheme;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = useParams();
  const locale = (params?.['locale'] as string) || 'ja';
  const t = getTranslation(filterSortBarTranslations, locale);
  const config = themeConfigs[theme];

  // デバウンス用タイマー
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

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

  // フィルター適用（内部実行）
  const executeApplyFilters = useCallback(
    (newSort: SortOption, providers: Set<string>, priceRanges: Set<string>): void => {
      const params = new URLSearchParams(searchParams.toString());

      // ソート
      if (newSort === defaultSort) {
        params['delete']('sort');
      } else {
        params.set('sort', newSort);
      }

      // プロバイダー（includeAspパラメータを使用、ヘッダーと統一）
      params['delete']('provider'); // 古いパラメータは削除
      if (providers.size === 0) {
        params['delete']('includeAsp');
      } else {
        params.set('includeAsp', Array.from(providers).join(','));
      }

      // 価格帯
      if (priceRanges.size === 0) {
        params['delete']('priceRange');
      } else {
        params.set('priceRange', Array.from(priceRanges).join(','));
      }

      params['delete']('page');

      const queryString = params.toString();
      router.push(`${pathname}${queryString ? `?${queryString}` : ''}`);
    },
    [searchParams, defaultSort, router, pathname],
  );

  // フィルター適用（デバウンス付き - 連続操作時の負荷軽減）
  const applyFilters = useCallback(
    (newSort: SortOption, providers: Set<string>, priceRanges: Set<string>): void => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        executeApplyFilters(newSort, providers, priceRanges);
      }, 300);
    },
    [executeApplyFilters],
  );

  // プロバイダーチェック切り替え
  const toggleProvider = useCallback(
    (providerId: string) => {
      const newProviders = new Set(selectedProviders);
      if (newProviders.has(providerId)) {
        newProviders.delete(providerId);
      } else {
        newProviders.add(providerId);
      }
      applyFilters(sortBy, newProviders, selectedPriceRanges);
    },
    [selectedProviders, selectedPriceRanges, sortBy, applyFilters],
  );

  // 価格帯チェック切り替え
  const togglePriceRange = useCallback(
    (range: string) => {
      const newRanges = new Set(selectedPriceRanges);
      if (newRanges.has(range)) {
        newRanges.delete(range);
      } else {
        newRanges.add(range);
      }
      applyFilters(sortBy, selectedProviders, newRanges);
    },
    [selectedPriceRanges, selectedProviders, sortBy, applyFilters],
  );

  // ソート変更
  const handleSortChange = useCallback(
    (newSort: SortOption) => {
      applyFilters(newSort, selectedProviders, selectedPriceRanges);
    },
    [selectedProviders, selectedPriceRanges, applyFilters],
  );

  // 全クリア
  const clearAllFilters = useCallback(() => {
    router.push(pathname);
  }, [router, pathname]);

  // Memoize hasActiveFilters to prevent recalculation
  const hasActiveFilters = useMemo(
    () => selectedProviders.size > 0 || selectedPriceRanges.size > 0 || sortBy !== defaultSort,
    [selectedProviders, selectedPriceRanges, sortBy, defaultSort],
  );

  // Memoize sort options to prevent recreation on every render
  const sortOptions = useMemo<{ value: SortOption; label: string }[]>(
    () => [
      { value: 'releaseDateDesc', label: t.releaseDateDesc },
      { value: 'releaseDateAsc', label: t.releaseDateAsc },
      { value: 'priceDesc', label: t.priceDesc },
      { value: 'priceAsc', label: t.priceAsc },
      { value: 'ratingDesc', label: t.ratingDesc },
      { value: 'ratingAsc', label: t.ratingAsc },
      { value: 'titleAsc', label: t.titleAsc },
    ],
    [t],
  );

  // Memoize price ranges to prevent recreation on every render
  const priceRanges = useMemo<{ value: string; label: string }[]>(
    () => [
      { value: '0-1000', label: '¥0 - ¥1,000' },
      { value: '1000-2000', label: '¥1,000 - ¥2,000' },
      { value: '2000-3000', label: '¥2,000 - ¥3,000' },
      { value: '3000', label: `¥3,000${t.priceAbove}` },
    ],
    [t.priceAbove],
  );

  return (
    <div className={config.container}>
      {/* ヘッダー：クリアボタン */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className={config.header}>{t.filter}</h3>
        {hasActiveFilters && (
          <button onClick={clearAllFilters} className={config.clearButton}>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            {t.clear}
          </button>
        )}
      </div>

      <div className="space-y-4">
        {/* ソート */}
        <div>
          <label className={config.label}>{t.sort}</label>
          <select
            value={sortBy}
            onChange={(e) => handleSortChange(e.target.value as SortOption)}
            className={config['select']}
            aria-label={t.sort}
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
            <label className={config.label}>{t.distributionService}</label>
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
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-white transition-all focus-within:ring-2 focus-within:ring-white focus-within:ring-offset-1 hover:opacity-90 ${
                      isSelected ? 'shadow-md ring-2 ring-white ring-offset-1' : ''
                    }`}
                    style={
                      meta.gradientColors
                        ? {
                            background: `linear-gradient(to right, ${meta.gradientColors.from}, ${meta.gradientColors.to})`,
                          }
                        : undefined
                    }
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleProvider(aspName)}
                      className="sr-only"
                      aria-label={`${meta.label}${count !== undefined ? ` (${count.toLocaleString()})` : ''}`}
                    />
                    {isSelected && (
                      <svg className="h-3 w-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                    {meta.label}
                    {count !== undefined && <span className="text-white/80">({count.toLocaleString()})</span>}
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* 価格フィルター（チェックボックス） */}
        {showPriceFilter && (
          <div>
            <label className={config.label}>{t.priceRange}</label>
            <div className="flex flex-wrap gap-2">
              {priceRanges.map((range) => {
                const isSelected = selectedPriceRanges.has(range.value);
                return (
                  <label
                    key={range.value}
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      isSelected ? config.priceSelected : config.priceUnselected
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

export default memo(FilterSortBarBase);
