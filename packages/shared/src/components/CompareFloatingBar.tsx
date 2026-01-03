'use client';

import { useCompareList } from '../hooks/useCompareList';
import Link from 'next/link';

interface CompareFloatingBarProps {
  locale: string;
  theme?: 'dark' | 'light';
  comparePagePath?: string;
}

export function CompareFloatingBar({
  locale,
  theme = 'dark',
  comparePagePath = '/compare',
}: CompareFloatingBarProps) {
  const { items, removeItem, clearAll, count, maxItems } = useCompareList();

  const isDark = theme === 'dark';

  const t = {
    compare: locale === 'ja' ? '比較する' : 'Compare',
    clearAll: locale === 'ja' ? 'クリア' : 'Clear',
    addMore: locale === 'ja' ? `あと${maxItems - count}件追加可能` : `${maxItems - count} more can be added`,
    items: locale === 'ja' ? '件' : 'items',
  };

  if (count === 0) return null;

  return (
    <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 ${
      isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
    } rounded-xl shadow-2xl border px-4 py-3 transition-all duration-300 animate-slide-up`}>
      <div className="flex items-center gap-4">
        {/* サムネイル一覧 */}
        <div className="flex items-center -space-x-2">
          {items.map((item, index) => (
            <div
              key={item.id}
              className="relative group"
              style={{ zIndex: items.length - index }}
            >
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className={`w-10 h-10 rounded-lg object-cover border-2 ${
                    isDark ? 'border-gray-800' : 'border-white'
                  }`}
                />
              ) : (
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center border-2 ${
                  isDark ? 'bg-gray-700 border-gray-800 text-gray-400' : 'bg-gray-100 border-white text-gray-500'
                }`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
              {/* 削除ボタン */}
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                className={`absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity ${
                  isDark ? 'bg-red-600 text-white' : 'bg-red-500 text-white'
                }`}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        {/* カウンター */}
        <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          <span className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{count}</span>/{maxItems}
          <span className="ml-1">{t.items}</span>
        </div>

        {/* アクションボタン */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={clearAll}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              isDark
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            {t.clearAll}
          </button>
          <Link
            href={`/${locale}${comparePagePath}?ids=${items.map(i => i.id).join(',')}`}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              isDark
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-pink-600 hover:bg-pink-700 text-white'
            }`}
          >
            {t.compare}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default CompareFloatingBar;
