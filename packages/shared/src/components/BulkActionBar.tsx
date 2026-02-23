'use client';

import { useState } from 'react';
import { useSiteTheme } from '../contexts/SiteThemeContext';
import { getTranslation, bulkActionBarTranslations } from '../lib/translations';

export interface BulkAction {
  id: string;
  label: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'danger';
  onClick: (selectedIds: string[]) => Promise<void> | void;
}

export interface BulkActionBarProps {
  selectedCount: number;
  selectedIds: string[];
  actions: BulkAction[];
  onClearSelection: () => void;
  onSelectAll?: () => void;
  totalCount?: number;
  locale?: string;
  theme?: 'dark' | 'light';
}

export function BulkActionBar({
  selectedCount,
  selectedIds,
  actions,
  onClearSelection,
  onSelectAll,
  totalCount,
  locale = 'ja',
  theme: themeProp,
}: BulkActionBarProps) {
  const { theme: contextTheme } = useSiteTheme();
  const theme = themeProp ?? contextTheme;
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const isDark = theme === 'dark';

  const t = getTranslation(bulkActionBarTranslations, locale);

  const handleAction = async (action: BulkAction) => {
    if (loadingAction) return;

    setLoadingAction(action.id);
    try {
      await action.onClick(selectedIds);
    } finally {
      setLoadingAction(null);
    }
  };

  if (selectedCount === 0) return null;

  return (
    <div
      className={`fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-xl px-4 py-3 shadow-2xl ${
        isDark ? 'border border-gray-700 bg-gray-800' : 'border border-gray-200 bg-white'
      }`}
      style={{ maxWidth: 'calc(100vw - 2rem)' }}
    >
      {/* 選択件数 */}
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
            isDark ? 'bg-blue-600 text-white' : 'bg-pink-600 text-white'
          }`}
        >
          {selectedCount}
        </span>
        <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
          {selectedCount}
          {t.selected}
        </span>
      </div>

      {/* 区切り線 */}
      <div className={`h-8 w-px ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />

      {/* すべて選択 / 選択解除 */}
      <div className="flex items-center gap-2">
        {onSelectAll && totalCount && selectedCount < totalCount && (
          <button
            type="button"
            onClick={onSelectAll}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
              isDark ? 'text-blue-400 hover:bg-gray-700' : 'text-pink-600 hover:bg-gray-100'
            }`}
          >
            {t.selectAll}
          </button>
        )}
        <button
          type="button"
          onClick={onClearSelection}
          className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
            isDark ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          {t.clearSelection}
        </button>
      </div>

      {/* 区切り線 */}
      <div className={`h-8 w-px ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />

      {/* アクションボタン */}
      <div className="flex items-center gap-2">
        {actions.map((action) => {
          const isLoading = loadingAction === action.id;
          const isDanger = action.variant === 'danger';

          return (
            <button
              key={action.id}
              type="button"
              onClick={() => handleAction(action)}
              disabled={!!loadingAction}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                isDanger
                  ? isDark
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-red-500 text-white hover:bg-red-600'
                  : isDark
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-pink-600 text-white hover:bg-pink-700'
              }`}
            >
              {isLoading ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  {t.processing}
                </>
              ) : (
                <>
                  {action.icon}
                  {action.label}
                </>
              )}
            </button>
          );
        })}
      </div>

      {/* 閉じるボタン */}
      <button
        type="button"
        onClick={onClearSelection}
        className={`ml-2 rounded-full p-1.5 transition-colors ${
          isDark
            ? 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
            : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
        }`}
        aria-label="Close"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export default BulkActionBar;
