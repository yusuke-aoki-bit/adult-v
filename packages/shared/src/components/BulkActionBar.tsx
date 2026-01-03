'use client';

import { useState } from 'react';

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
  theme = 'dark',
}: BulkActionBarProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const isDark = theme === 'dark';

  const t = {
    selected: locale === 'ja' ? '件選択中' : ' selected',
    selectAll: locale === 'ja' ? 'すべて選択' : 'Select all',
    clearSelection: locale === 'ja' ? '選択解除' : 'Clear selection',
    processing: locale === 'ja' ? '処理中...' : 'Processing...',
  };

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
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 rounded-xl shadow-2xl px-4 py-3 flex items-center gap-4 ${
        isDark
          ? 'bg-gray-800 border border-gray-700'
          : 'bg-white border border-gray-200'
      }`}
      style={{ maxWidth: 'calc(100vw - 2rem)' }}
    >
      {/* 選択件数 */}
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
            isDark ? 'bg-blue-600 text-white' : 'bg-pink-600 text-white'
          }`}
        >
          {selectedCount}
        </span>
        <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
          {locale === 'ja' ? `${selectedCount}${t.selected}` : `${selectedCount}${t.selected}`}
        </span>
      </div>

      {/* 区切り線 */}
      <div className={`w-px h-8 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />

      {/* すべて選択 / 選択解除 */}
      <div className="flex items-center gap-2">
        {onSelectAll && totalCount && selectedCount < totalCount && (
          <button
            type="button"
            onClick={onSelectAll}
            className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
              isDark
                ? 'text-blue-400 hover:bg-gray-700'
                : 'text-pink-600 hover:bg-gray-100'
            }`}
          >
            {t.selectAll}
          </button>
        )}
        <button
          type="button"
          onClick={onClearSelection}
          className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
            isDark
              ? 'text-gray-400 hover:bg-gray-700'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          {t.clearSelection}
        </button>
      </div>

      {/* 区切り線 */}
      <div className={`w-px h-8 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />

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
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                isDanger
                  ? isDark
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-red-500 hover:bg-red-600 text-white'
                  : isDark
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-pink-600 hover:bg-pink-700 text-white'
              }`}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
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
        className={`ml-2 p-1.5 rounded-full transition-colors ${
          isDark
            ? 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
            : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
        }`}
        aria-label="Close"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export default BulkActionBar;
