'use client';

import { useState, useEffect, useRef } from 'react';
import { useCompareList } from '../hooks/useCompareList';
import Link from 'next/link';

interface CompareFloatingBarProps {
  locale: string;
  theme?: 'dark' | 'light';
  comparePagePath?: string;
  /** 選択モードの時のみ表示する場合にtrueを渡す */
  isSelectionMode?: boolean;
}

// セッション中にヒントを表示したかどうかを記録
const HINT_SHOWN_KEY = 'compare_hint_shown_session';

export function CompareFloatingBar({
  locale,
  theme = 'dark',
  comparePagePath = '/compare',
  isSelectionMode,
}: CompareFloatingBarProps) {
  const { items, removeItem, clearAll, count, maxItems } = useCompareList();
  const [isFirstShow, setIsFirstShow] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [mounted, setMounted] = useState(false);
  const hasShownHintRef = useRef(false);

  const isDark = theme === 'dark';

  const t = {
    compare: locale === 'ja' ? '比較する' : 'Compare',
    clearAll: locale === 'ja' ? 'クリア' : 'Clear',
    addMore: locale === 'ja' ? `あと${maxItems - count}件追加可能` : `${maxItems - count} more can be added`,
    items: locale === 'ja' ? '件' : 'items',
    hint: locale === 'ja'
      ? '「比較する」ボタンで比較ページへ'
      : 'Click "Compare" to view comparison',
    compareReady: locale === 'ja' ? '比較できます！' : 'Ready to compare!',
  };

  // マウント時にセッションストレージをチェック
  useEffect(() => {
    setMounted(true);
    const hintShown = sessionStorage.getItem(HINT_SHOWN_KEY);
    if (hintShown) {
      hasShownHintRef.current = true;
    }
  }, []);

  // 比較リストにアイテムがあり、まだヒントを表示していない場合に表示
  useEffect(() => {
    if (!mounted) return;

    if (count > 0 && !hasShownHintRef.current) {
      hasShownHintRef.current = true;
      sessionStorage.setItem(HINT_SHOWN_KEY, 'true');
      setIsFirstShow(true);
      setShowHint(true);

      // ヒントを5秒後に非表示
      const timer = setTimeout(() => {
        setShowHint(false);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [count, mounted]);

  // パルスアニメーションを3秒後に解除
  useEffect(() => {
    if (isFirstShow) {
      const timer = setTimeout(() => {
        setIsFirstShow(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isFirstShow]);

  // 選択モードが明示的にfalseの場合、または比較リストが空の場合は非表示
  if (isSelectionMode === false || count === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2">
      {/* ヒントメッセージ（初回表示時） */}
      {showHint && (
        <div className={`px-4 py-2 rounded-lg text-sm animate-fade-in ${
          isDark ? 'bg-blue-600 text-white' : 'bg-pink-600 text-white'
        }`}>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
            <span>{t.hint}</span>
          </div>
        </div>
      )}

      {/* メインバー */}
      <div className={`${
        isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      } rounded-xl shadow-2xl border px-4 py-3 transition-all duration-300 animate-slide-up ${
        isFirstShow ? 'ring-2 ring-offset-2 animate-pulse' : ''
      } ${isFirstShow ? (isDark ? 'ring-blue-500 ring-offset-gray-900' : 'ring-pink-500 ring-offset-white') : ''}`}>
        <div className="flex items-center gap-4">
        {/* サムネイル一覧 */}
        <div className="flex items-center -space-x-1">
          {items.map((item, index) => (
            <div
              key={item.id}
              className="relative"
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
              {/* 削除ボタン - 常に表示、クリック領域拡大 */}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  removeItem(item.id);
                }}
                className={`absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shadow-md ${
                  isDark ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-red-500 hover:bg-red-400 text-white'
                }`}
                aria-label={`Remove ${item.title}`}
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
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
              isDark
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-pink-600 hover:bg-pink-700 text-white'
            } ${isFirstShow ? 'animate-pulse' : ''}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            {t.compare}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
        </div>
        </div>
      </div>
    </div>
  );
}

export default CompareFloatingBar;
