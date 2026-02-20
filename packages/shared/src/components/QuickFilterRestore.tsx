'use client';

import { useState, useEffect } from 'react';

interface QuickFilterRestoreProps {
  /** 現在のURL */
  currentPath: string;
  /** ロケール */
  locale: string;
  /** テーマ */
  theme?: 'dark' | 'light';
  /** 翻訳 */
  translations?: {
    restoreFilters?: string;
    lastUsedFilters?: string;
    dismiss?: string;
  };
}

interface SavedFilter {
  path: string;
  params: string;
  savedAt: number;
}

const STORAGE_KEY = 'quick_filter_state';
const EXPIRY_HOURS = 24;

function getStorageKey(path: string): string {
  // パスからページタイプを抽出（例: /ja/products → products）
  const parts = path.split('/').filter(Boolean);
  if (parts.length < 2) return 'home';
  return parts[1] || 'home';
}

export function QuickFilterRestore({
  currentPath,
  locale,
  theme = 'dark',
  translations,
}: QuickFilterRestoreProps) {
  const [savedFilter, setSavedFilter] = useState<SavedFilter | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  const defaultTexts = {
    ja: { restoreFilters: '前回のフィルターを復元', lastUsedFilters: '前回使用したフィルター', dismiss: '閉じる' },
    en: { restoreFilters: 'Restore previous filters', lastUsedFilters: 'Last used filters', dismiss: 'Dismiss' },
  } as const;
  const dt = defaultTexts[locale as keyof typeof defaultTexts] || defaultTexts.ja;
  const t = {
    restoreFilters: translations?.restoreFilters || dt.restoreFilters,
    lastUsedFilters: translations?.lastUsedFilters || dt.lastUsedFilters,
    dismiss: translations?.dismiss || dt.dismiss,
  };

  const isDark = theme === 'dark';

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const filters: Record<string, SavedFilter> = JSON.parse(stored);
        const pageKey = getStorageKey(currentPath);
        const filter = filters[pageKey];

        if (filter) {
          const now = Date.now();
          const expiryTime = filter.savedAt + EXPIRY_HOURS * 60 * 60 * 1000;

          // 有効期限内で、現在のURLと異なる場合のみ表示
          if (now < expiryTime && filter.params && !currentPath.includes('?')) {
            setSavedFilter(filter);
          } else if (now >= expiryTime) {
            // 有効期限切れの場合は削除
            delete filters[pageKey];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
          }
        }
      }
    } catch (e) {
      console.error('Failed to load saved filters:', e);
    }
  }, [currentPath]);

  // 現在のフィルターを保存
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const searchParams = window.location.search;
    if (searchParams && searchParams.length > 1) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const filters: Record<string, SavedFilter> = stored ? JSON.parse(stored) : {};
        const pageKey = getStorageKey(currentPath);

        filters[pageKey] = {
          path: currentPath.split('?')[0] ?? '',
          params: searchParams,
          savedAt: Date.now(),
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
      } catch (e) {
        console.error('Failed to save filters:', e);
      }
    }
  }, [currentPath]);

  if (!savedFilter || isDismissed) return null;

  const restoreUrl = `${savedFilter.path}${savedFilter.params}`;

  return (
    <div className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-50 animate-slide-up ${
      isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
    } rounded-lg shadow-xl border px-4 py-3 flex items-center gap-3`}>
      <div className={`p-2 rounded-full ${isDark ? 'bg-blue-600/20' : 'bg-blue-50'}`}>
        <svg className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div className="flex-1">
        <p className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
          {t.lastUsedFilters}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <a
          href={restoreUrl}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
            isDark
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {t.restoreFilters}
        </a>
        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          className={`p-1.5 rounded-lg transition-colors ${
            isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
          }`}
          aria-label={t.dismiss}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default QuickFilterRestore;
