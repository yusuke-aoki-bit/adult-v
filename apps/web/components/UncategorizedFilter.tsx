'use client';

import { useRouter, useSearchParams, usePathname, useParams } from 'next/navigation';
import { providerMeta } from '@/lib/providers';
import { ASP_TO_PROVIDER_ID } from '@/lib/constants/filters';

const filterTexts = {
  ja: { settings: 'フィルター設定', pattern: '品番パターン', site: '配信サイト', clear: 'クリア' },
  en: { settings: 'Filter Settings', pattern: 'Product Pattern', site: 'Distribution Sites', clear: 'Clear' },
} as const;
function getFilterText(locale: string) {
  return filterTexts[locale as keyof typeof filterTexts] || filterTexts.ja;
}

interface PatternStat {
  pattern: string;
  label: string;
  count: number;
}

interface AspStat {
  aspName: string;
  count: number;
}

interface UncategorizedFilterProps {
  patternStats: PatternStat[];
  aspStats: AspStat[];
}

export default function UncategorizedFilter({ patternStats, aspStats }: UncategorizedFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 現在のフィルター状態を取得
  const selectedPattern = searchParams.get('pattern') || '';
  const selectedAsp = searchParams.get('asp') || '';

  // フィルター更新関数
  const updateFilter = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('page'); // フィルター変更時はページをリセット

    if (value === null || value === '') {
      params.delete(key);
    } else {
      params.set(key, value);
    }

    const queryString = params.toString();
    router.push(`${pathname}${queryString ? `?${queryString}` : ''}`);
  };

  const handlePatternChange = (pattern: string) => {
    updateFilter('pattern', selectedPattern === pattern ? null : pattern);
  };

  const handleAspChange = (aspName: string) => {
    updateFilter('asp', selectedAsp === aspName ? null : aspName);
  };

  // クリアボタン
  const handleClear = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('pattern');
    params.delete('asp');
    params.delete('page');

    const queryString = params.toString();
    router.push(`${pathname}${queryString ? `?${queryString}` : ''}`);
  };

  const params = useParams();
  const locale = (params?.['locale'] as string) || 'ja';
  const ft = getFilterText(locale);

  const hasActiveFilters = selectedPattern !== '' || selectedAsp !== '';
  const activeFilterCount = (selectedPattern ? 1 : 0) + (selectedAsp ? 1 : 0);

  return (
    <details className="mb-4 rounded-lg border border-gray-700 bg-gray-800 sm:mb-8" open={hasActiveFilters}>
      <summary className="hover:bg-gray-750 flex min-h-[56px] cursor-pointer items-center justify-between px-4 py-4 font-semibold text-white select-none active:bg-gray-700 sm:min-h-0 sm:py-3">
        <div className="flex items-center gap-3 sm:gap-2">
          <svg className="h-6 w-6 text-gray-400 sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
          </svg>
          <span className="text-base sm:text-sm">{ft.settings}</span>
        </div>
        {hasActiveFilters && (
          <span className="rounded-full bg-yellow-600 px-2.5 py-1 text-xs font-medium text-white sm:px-2 sm:py-0.5">
            {activeFilterCount}
          </span>
        )}
      </summary>
      <div className="space-y-5 px-4 pb-4 sm:space-y-6">
        {/* 品番パターンフィルター */}
        {patternStats.length > 0 && (
          <div>
            <h3 className="mb-3 text-base font-semibold text-white sm:text-sm">{ft.pattern}</h3>
            <div className="flex flex-wrap gap-2">
              {patternStats.map((stat) => {
                const isSelected = selectedPattern === stat.pattern;
                return (
                  <button
                    key={stat.pattern}
                    onClick={() => handlePatternChange(stat.pattern)}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                      isSelected
                        ? 'bg-yellow-600 text-white ring-2 ring-yellow-400'
                        : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                    }`}
                  >
                    {stat.label}
                    <span className="ml-1.5 text-xs opacity-80">({stat.count.toLocaleString()})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 配信サイト（ASP）フィルター */}
        {aspStats.length > 0 && (
          <div>
            <h3 className="mb-3 text-base font-semibold text-white sm:text-sm">{ft.site}</h3>
            <div className="flex flex-wrap gap-2">
              {aspStats.map((asp) => {
                const providerId = ASP_TO_PROVIDER_ID[asp.aspName];
                const meta = providerId ? providerMeta[providerId] : null;
                const isSelected = selectedAsp === asp.aspName;
                return (
                  <button
                    key={asp.aspName}
                    onClick={() => handleAspChange(asp.aspName)}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                      isSelected ? 'ring-2 ring-yellow-400' : 'hover:opacity-80'
                    } bg-linear-to-r ${meta?.accentClass || 'from-gray-600 to-gray-500'} text-white`}
                  >
                    {meta?.label || asp.aspName}
                    <span className="ml-1.5 text-xs opacity-80">({asp.count.toLocaleString()})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* クリアボタン */}
        {hasActiveFilters && (
          <div className="flex flex-col gap-2 pt-2 sm:flex-row">
            <button
              type="button"
              onClick={handleClear}
              className="min-h-[52px] flex-1 rounded-lg border border-gray-600 px-6 py-3.5 text-center font-medium text-gray-200 transition-colors hover:bg-gray-700 active:bg-gray-600 sm:min-h-0 sm:flex-none sm:rounded-md sm:py-2"
            >
              {ft.clear}
            </button>
          </div>
        )}
      </div>
    </details>
  );
}
