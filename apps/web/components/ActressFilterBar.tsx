'use client';

import { useRouter, useSearchParams, usePathname, useParams } from 'next/navigation';
import { useTransition, useState } from 'react';
import { ChevronDown, ChevronUp, Filter, X } from 'lucide-react';

// デビュー年オプション
const DEBUT_YEAR_OPTIONS = [
  { label: '2024年〜', value: '2024-' },
  { label: '2020-2023年', value: '2020-2023' },
  { label: '2015-2019年', value: '2015-2019' },
  { label: '2010-2014年', value: '2010-2014' },
  { label: '〜2009年', value: '-2009' },
];

// 作品数オプション
const WORK_COUNT_OPTIONS = [
  { label: '100作品以上', value: '100' },
  { label: '50作品以上', value: '50' },
  { label: '30作品以上', value: '30' },
  { label: '10作品以上', value: '10' },
];

const translations = {
  ja: {
    filter: 'フィルター',
    debutYear: 'デビュー年',
    workCount: '作品数',
    clear: 'クリア',
    clearAll: 'すべてクリア',
  },
  en: {
    filter: 'Filter',
    debutYear: 'Debut Year',
    workCount: 'Work Count',
    clear: 'Clear',
    clearAll: 'Clear All',
  },
} as const;

export default function ActressFilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = useParams();
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const locale = (params?.['locale'] as string) || 'ja';
  const t = translations[locale as keyof typeof translations] || translations['ja'];

  // 現在のフィルター状態
  const debutYear = searchParams.get('debutYear') || '';
  const minWorks = searchParams.get('minWorks') || '';

  // アクティブなフィルター数
  const activeFilterCount = [debutYear, minWorks].filter(Boolean).length;

  // フィルター更新関数
  const updateFilter = (key: string, value: string | null) => {
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.delete('page');

    if (value === null || value === '') {
      newParams.delete(key);
    } else {
      newParams.set(key, value);
    }

    const queryString = newParams.toString();
    startTransition(() => {
      router.push(`${pathname}${queryString ? `?${queryString}` : ''}`);
    });
  };

  // すべてクリア
  const clearAllFilters = () => {
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.delete('debutYear');
    newParams.delete('minWorks');
    newParams.delete('page');

    const queryString = newParams.toString();
    startTransition(() => {
      router.push(`${pathname}${queryString ? `?${queryString}` : ''}`);
    });
  };

  return (
    <div className="mb-4">
      {/* トグルボタン */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          activeFilterCount > 0 || isOpen
            ? 'bg-pink-600 text-white'
            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
        }`}
      >
        <Filter className="w-4 h-4" />
        {t.filter}
        {activeFilterCount > 0 && (
          <span className="px-1.5 py-0.5 text-xs bg-white/20 rounded">
            {activeFilterCount}
          </span>
        )}
        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {/* フィルターパネル */}
      {isOpen && (
        <div className={`mt-3 p-4 bg-gray-800 rounded-lg border border-gray-700 ${isPending ? 'opacity-50' : ''}`}>
          <div className="space-y-4">
            {/* デビュー年 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-300">{t.debutYear}</h3>
                {debutYear && (
                  <button
                    onClick={() => updateFilter('debutYear', null)}
                    className="text-xs text-pink-400 hover:text-pink-300 flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    {t.clear}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {DEBUT_YEAR_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => updateFilter('debutYear', debutYear === option.value ? null : option.value)}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                      debutYear === option.value
                        ? 'bg-pink-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 作品数 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-300">{t.workCount}</h3>
                {minWorks && (
                  <button
                    onClick={() => updateFilter('minWorks', null)}
                    className="text-xs text-pink-400 hover:text-pink-300 flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    {t.clear}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {WORK_COUNT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => updateFilter('minWorks', minWorks === option.value ? null : option.value)}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                      minWorks === option.value
                        ? 'bg-pink-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* すべてクリア */}
            {activeFilterCount > 0 && (
              <div className="pt-2 border-t border-gray-700">
                <button
                  onClick={clearAllFilters}
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  {t.clearAll}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
