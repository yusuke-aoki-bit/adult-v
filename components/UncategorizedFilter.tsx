'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { providerMeta } from '@/lib/providers';
import { ASP_TO_PROVIDER_ID } from '@/lib/constants/filters';

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

export default function UncategorizedFilter({
  patternStats,
  aspStats,
}: UncategorizedFilterProps) {
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

  const hasActiveFilters = selectedPattern !== '' || selectedAsp !== '';
  const activeFilterCount = (selectedPattern ? 1 : 0) + (selectedAsp ? 1 : 0);

  return (
    <details
      className="mb-4 sm:mb-8 bg-gray-800 rounded-lg border border-gray-700"
      open={hasActiveFilters}
    >
      <summary className="px-4 py-4 sm:py-3 cursor-pointer font-semibold text-white hover:bg-gray-750 active:bg-gray-700 flex items-center justify-between min-h-[56px] sm:min-h-0 select-none">
        <div className="flex items-center gap-3 sm:gap-2">
          <svg className="w-6 h-6 sm:w-5 sm:h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <span className="text-base sm:text-sm">フィルター設定</span>
        </div>
        {hasActiveFilters && (
          <span className="text-xs bg-yellow-600 text-white px-2.5 py-1 sm:px-2 sm:py-0.5 rounded-full font-medium">
            {activeFilterCount}
          </span>
        )}
      </summary>
      <div className="px-4 pb-4 space-y-5 sm:space-y-6">
        {/* 品番パターンフィルター */}
        {patternStats.length > 0 && (
          <div>
            <h3 className="text-base sm:text-sm font-semibold text-white mb-3">品番パターン</h3>
            <div className="flex flex-wrap gap-2">
              {patternStats.map((stat) => {
                const isSelected = selectedPattern === stat.pattern;
                return (
                  <button
                    key={stat.pattern}
                    onClick={() => handlePatternChange(stat.pattern)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
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
            <h3 className="text-base sm:text-sm font-semibold text-white mb-3">配信サイト</h3>
            <div className="flex flex-wrap gap-2">
              {aspStats.map((asp) => {
                const providerId = ASP_TO_PROVIDER_ID[asp.aspName];
                const meta = providerId ? providerMeta[providerId] : null;
                const isSelected = selectedAsp === asp.aspName;
                return (
                  <button
                    key={asp.aspName}
                    onClick={() => handleAspChange(asp.aspName)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isSelected
                        ? 'ring-2 ring-yellow-400'
                        : 'hover:opacity-80'
                    } bg-gradient-to-r ${meta?.accentClass || 'from-gray-600 to-gray-500'} text-white`}
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
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <button
              type="button"
              onClick={handleClear}
              className="flex-1 sm:flex-none text-center px-6 py-3.5 sm:py-2 border border-gray-600 text-gray-200 rounded-lg sm:rounded-md font-medium hover:bg-gray-700 active:bg-gray-600 transition-colors min-h-[52px] sm:min-h-0"
            >
              クリア
            </button>
          </div>
        )}
      </div>
    </details>
  );
}
