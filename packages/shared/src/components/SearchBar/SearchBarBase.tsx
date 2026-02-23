'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { getTranslation, searchBarTranslations } from '../../lib/translations';

export type SearchBarTheme = 'dark' | 'light';

export interface AiSearchResult {
  searchParams: Record<string, string | string[]>;
  redirect?: string;
  message?: string;
  relatedTerms?: string[];
}

export interface SearchBarBaseProps {
  theme: SearchBarTheme;
  locale: string;
  onActressSearch: (query: string) => void;
  onProductSearch: (query: string) => Promise<void>;
  /** AI検索のコールバック（設定されている場合、AI検索モードが有効になる） */
  onAiSearch?: (result: AiSearchResult) => void;
  /** AI検索APIエンドポイント */
  aiApiEndpoint?: string;
}

const themeStyles = {
  dark: {
    input: 'bg-gray-800 text-white border-gray-700 focus:ring-rose-500',
    shortcutBg: 'bg-gray-700 text-gray-400',
    shortcutText: 'text-gray-500',
    clearHover: 'hover:text-white',
    spinnerBorder: 'border-white',
    aiToggle: 'bg-gray-700 text-gray-400',
    aiToggleActive: 'bg-linear-to-r from-purple-600 to-pink-600 text-white',
  },
  light: {
    input: 'bg-white text-gray-900 border-gray-300 focus:ring-pink-500 placeholder:text-gray-400',
    shortcutBg: 'bg-gray-100 text-gray-500 border border-gray-200',
    shortcutText: 'text-gray-400',
    clearHover: 'hover:text-gray-700',
    spinnerBorder: 'border-gray-700',
    aiToggle: 'bg-gray-200 text-gray-500',
    aiToggleActive: 'bg-linear-to-r from-purple-500 to-pink-500 text-white',
  },
};

export function SearchBarBase({
  theme,
  locale,
  onActressSearch,
  onProductSearch,
  onAiSearch,
  aiApiEndpoint = '/api/search/ai',
}: SearchBarBaseProps) {
  const [actressQuery, setActressQuery] = useState('');
  const [productQuery, setProductQuery] = useState('');
  const [aiQuery, setAiQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [showShortcutHint, setShowShortcutHint] = useState(true);
  const [isAiMode, setIsAiMode] = useState(false);

  const t = getTranslation(searchBarTranslations, locale);
  const styles = themeStyles[theme];

  const actressInputRef = useRef<HTMLInputElement>(null);
  const aiInputRef = useRef<HTMLInputElement>(null);
  const actressDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const productDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Keyboard shortcuts (/ or Ctrl+K to focus search)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInputElement = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // Ctrl+K / Cmd+K: 入力欄でも発火
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (isAiMode && aiInputRef.current) {
          aiInputRef.current.focus();
        } else if (actressInputRef.current) {
          actressInputRef.current.focus();
        }
        setShowShortcutHint(false);
        return;
      }

      // / キー: 入力欄では発火しない
      if (isInputElement) {
        return;
      }

      if (e.key === '/') {
        e.preventDefault();
        if (isAiMode && aiInputRef.current) {
          aiInputRef.current.focus();
        } else if (actressInputRef.current) {
          actressInputRef.current.focus();
        }
        setShowShortcutHint(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAiMode]);

  // Actress search handler with debounce
  const handleActressChange = useCallback(
    (value: string) => {
      setActressQuery(value);

      if (actressDebounceRef.current) {
        clearTimeout(actressDebounceRef.current);
      }

      actressDebounceRef.current = setTimeout(() => {
        if (value.trim().length >= 2) {
          onActressSearch(value.trim());
        }
      }, 500);
    },
    [onActressSearch],
  );

  // Product search handler with debounce
  const handleProductChange = useCallback(
    (value: string) => {
      setProductQuery(value);

      if (productDebounceRef.current) {
        clearTimeout(productDebounceRef.current);
      }

      productDebounceRef.current = setTimeout(async () => {
        if (value.trim().length >= 2) {
          setIsSearching(true);
          try {
            await onProductSearch(value.trim());
          } finally {
            setIsSearching(false);
          }
        }
      }, 700);
    },
    [onProductSearch],
  );

  // AI search handler
  const handleAiSearch = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim() || searchQuery.trim().length < 3 || !onAiSearch) return;

      setIsAiSearching(true);

      try {
        const response = await fetch(aiApiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: searchQuery.trim(), locale }),
        });

        if (!response.ok) {
          throw new Error('AI search failed');
        }

        const data = await response.json();

        if (data.success) {
          onAiSearch({
            searchParams: data.searchParams || {},
            redirect: data.redirect,
            message: data.message,
            relatedTerms: data.relatedTerms,
          });
          setAiQuery('');
        }
      } catch (err) {
        console.error('[AI Search] Error:', err);
      } finally {
        setIsAiSearching(false);
      }
    },
    [aiApiEndpoint, locale, onAiSearch],
  );

  const handleAiKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && aiQuery.trim().length >= 3) {
        handleAiSearch(aiQuery);
      }
    },
    [aiQuery, handleAiSearch],
  );

  // Cleanup
  useEffect(() => {
    return () => {
      if (actressDebounceRef.current) clearTimeout(actressDebounceRef.current);
      if (productDebounceRef.current) clearTimeout(productDebounceRef.current);
    };
  }, []);

  // AI検索モードが有効な場合
  if (isAiMode && onAiSearch) {
    return (
      <div className="flex items-center gap-2">
        {/* AI/通常モード切り替えボタン */}
        <button
          type="button"
          onClick={() => setIsAiMode(false)}
          className={`shrink-0 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors ${styles.aiToggleActive}`}
          title={t.normalMode}
        >
          <span className="flex items-center gap-1">
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
            {t.aiMode}
          </span>
        </button>

        {/* AI検索入力 */}
        <div className="relative flex-1">
          <input
            ref={aiInputRef}
            type="text"
            value={aiQuery}
            onChange={(e) => setAiQuery(e.target.value)}
            onKeyDown={handleAiKeyDown}
            onFocus={() => setShowShortcutHint(false)}
            placeholder={t.aiPlaceholder}
            aria-label={t.aiPlaceholder}
            disabled={isAiSearching}
            className={`w-full rounded-lg border px-4 py-2 pr-8 pl-10 text-sm focus:border-transparent focus:ring-2 focus:outline-none disabled:opacity-50 ${styles.input}`}
          />
          <svg
            className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-purple-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          {isAiSearching ? (
            <div className="absolute top-1/2 right-3 flex -translate-y-1/2 transform items-center gap-1">
              <div className={`h-4 w-4 animate-spin rounded-full border-b-2 ${styles.spinnerBorder}`}></div>
              <span className="hidden text-xs text-gray-400 sm:inline">{t.aiAnalyzing}</span>
            </div>
          ) : aiQuery ? (
            <button
              type="button"
              onClick={() => setAiQuery('')}
              className={`absolute top-1/2 right-3 -translate-y-1/2 transform text-gray-400 ${styles.clearHover} transition-colors`}
              aria-label={t.clear}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : (
            showShortcutHint && (
              <span
                className={`absolute top-1/2 right-3 hidden -translate-y-1/2 transform items-center gap-1 text-xs sm:flex ${styles.shortcutText} pointer-events-none`}
              >
                <kbd className={`rounded px-1.5 py-0.5 font-mono ${styles.shortcutBg}`}>/</kbd>
              </span>
            )
          )}
        </div>

        {/* 検索実行ボタン */}
        <button
          type="button"
          onClick={() => handleAiSearch(aiQuery)}
          disabled={aiQuery.trim().length < 3 || isAiSearching}
          className={`shrink-0 rounded-lg p-2 transition-colors ${
            aiQuery.trim().length >= 3 && !isAiSearching
              ? 'bg-linear-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700'
              : theme === 'dark'
                ? 'bg-gray-700 text-gray-500'
                : 'bg-gray-200 text-gray-400'
          } disabled:cursor-not-allowed`}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      {/* AI検索モード切り替えボタン（onAiSearchが設定されている場合のみ表示） */}
      {onAiSearch && (
        <button
          type="button"
          onClick={() => setIsAiMode(true)}
          className={`hidden shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors sm:flex ${styles.aiToggle} hover:opacity-80`}
          title={t.aiMode}
        >
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
          {t.aiMode}
        </button>
      )}

      {/* Actress search */}
      <div className="relative flex-1">
        <input
          ref={actressInputRef}
          type="text"
          value={actressQuery}
          onChange={(e) => handleActressChange(e.target.value)}
          onFocus={() => setShowShortcutHint(false)}
          placeholder={t.actressPlaceholder}
          aria-label={t.actressPlaceholder}
          className={`w-full rounded-lg border px-4 py-2 pr-8 pl-10 text-sm focus:border-transparent focus:ring-2 focus:outline-none ${styles.input}`}
        />
        {/* Keyboard shortcut hint */}
        {showShortcutHint && !actressQuery && (
          <span
            className={`absolute top-1/2 right-3 hidden -translate-y-1/2 transform items-center gap-1 text-xs sm:flex ${styles.shortcutText} pointer-events-none`}
          >
            <kbd className={`rounded px-1.5 py-0.5 font-mono ${styles.shortcutBg}`}>/</kbd>
          </span>
        )}
        <svg
          className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
        {actressQuery && (
          <button
            type="button"
            onClick={() => setActressQuery('')}
            className={`absolute top-1/2 right-3 -translate-y-1/2 transform text-gray-400 ${styles.clearHover} transition-colors`}
            aria-label={t.clear}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Product search */}
      <div className="relative flex-1">
        <input
          type="text"
          value={productQuery}
          onChange={(e) => handleProductChange(e.target.value)}
          placeholder={t.productPlaceholder}
          aria-label={t.productPlaceholder}
          disabled={isSearching}
          className={`w-full rounded-lg border px-4 py-2 pr-8 pl-10 text-sm focus:border-transparent focus:ring-2 focus:outline-none disabled:opacity-50 ${styles.input}`}
        />
        <svg
          className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
          />
        </svg>
        {isSearching ? (
          <div className="absolute top-1/2 right-3 -translate-y-1/2 transform">
            <div className={`h-4 w-4 animate-spin rounded-full border-b-2 ${styles.spinnerBorder}`}></div>
          </div>
        ) : (
          productQuery && (
            <button
              type="button"
              onClick={() => setProductQuery('')}
              className={`absolute top-1/2 right-3 -translate-y-1/2 transform text-gray-400 ${styles.clearHover} transition-colors`}
              aria-label={t.clear}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )
        )}
      </div>
    </div>
  );
}
