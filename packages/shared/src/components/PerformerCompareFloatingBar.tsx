'use client';

import { useState, useEffect, useRef } from 'react';
import { usePerformerCompareList } from '../hooks/usePerformerCompareList';
import Link from 'next/link';

interface PerformerCompareFloatingBarProps {
  locale: string;
  theme?: 'dark' | 'light';
  comparePagePath?: string;
  /** 選択モードの時のみ表示する場合にtrueを渡す */
  isSelectionMode?: boolean;
}

// セッション中にヒントを表示したかどうかを記録
const PERFORMER_HINT_SHOWN_KEY = 'performer_compare_hint_shown_session';

export function PerformerCompareFloatingBar({
  locale,
  theme = 'dark',
  comparePagePath = '/compare/performers',
  isSelectionMode,
}: PerformerCompareFloatingBarProps) {
  const { items, removeItem, clearAll, count, maxItems } = usePerformerCompareList();
  const [isFirstShow, setIsFirstShow] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [mounted, setMounted] = useState(false);
  const hasShownHintRef = useRef(false);

  const isDark = theme === 'dark';

  const t = {
    compare: locale === 'ja' ? '比較する' : 'Compare',
    clearAll: locale === 'ja' ? 'クリア' : 'Clear',
    performers: locale === 'ja' ? '名' : 'performers',
    hint: locale === 'ja'
      ? '「比較する」ボタンで比較ページへ'
      : 'Click "Compare" to view comparison',
  };

  // マウント時にセッションストレージをチェック
  useEffect(() => {
    setMounted(true);
    const hintShown = sessionStorage.getItem(PERFORMER_HINT_SHOWN_KEY);
    if (hintShown) {
      hasShownHintRef.current = true;
    }
  }, []);

  // 比較リストにアイテムがあり、まだヒントを表示していない場合に表示
  useEffect(() => {
    if (!mounted) return;

    if (count > 0 && !hasShownHintRef.current) {
      hasShownHintRef.current = true;
      sessionStorage.setItem(PERFORMER_HINT_SHOWN_KEY, 'true');
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
          isDark ? 'bg-purple-600 text-white' : 'bg-pink-600 text-white'
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
      } ${isFirstShow ? (isDark ? 'ring-purple-500 ring-offset-gray-900' : 'ring-pink-500 ring-offset-white') : ''}`}>
      <div className="flex items-center gap-4">
        {/* サムネイル一覧 */}
        <div className="flex items-center -space-x-1">
          {items.map((item, index) => (
            <div
              key={item['id']}
              className="relative"
              style={{ zIndex: items.length - index }}
            >
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item['name']}
                  className={`w-10 h-10 rounded-full object-cover border-2 ${
                    isDark ? 'border-gray-800' : 'border-white'
                  }`}
                />
              ) : (
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                  isDark ? 'bg-gray-700 border-gray-800 text-gray-400' : 'bg-gray-100 border-white text-gray-500'
                }`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              )}
              {/* 削除ボタン - 常に表示、クリック領域拡大 */}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  removeItem(item['id']);
                }}
                className={`absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shadow-md ${
                  isDark ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-red-500 hover:bg-red-400 text-white'
                }`}
                aria-label={`Remove ${item['name']}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        {/* カウンター */}
        <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          <span className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{count}</span>/{maxItems}
          <span className="ml-1">{t.performers}</span>
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
                ? 'bg-purple-600 hover:bg-purple-700 text-white'
                : 'bg-pink-600 hover:bg-pink-700 text-white'
            }`}
          >
            {t.compare}
          </Link>
        </div>
        </div>
      </div>
    </div>
  );
}

export default PerformerCompareFloatingBar;
