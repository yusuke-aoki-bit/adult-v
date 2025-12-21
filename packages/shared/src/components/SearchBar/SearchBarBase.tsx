'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// Translations for SearchBar
export const searchBarTranslations = {
  ja: {
    actressPlaceholder: '女優名・プロフィールで検索...',
    productPlaceholder: '作品名・作品ID・説明文で検索...',
    shortcutHint: '/ キーで検索',
    clear: 'クリア',
  },
  en: {
    actressPlaceholder: 'Search by actress name or profile...',
    productPlaceholder: 'Search by title, product ID, or description...',
    shortcutHint: 'Press / to search',
    clear: 'Clear',
  },
  zh: {
    actressPlaceholder: '按女优名称或简介搜索...',
    productPlaceholder: '按标题、产品ID或描述搜索...',
    shortcutHint: '按 / 键搜索',
    clear: '清除',
  },
  ko: {
    actressPlaceholder: '여배우 이름 또는 프로필로 검색...',
    productPlaceholder: '제목, 제품 ID 또는 설명으로 검색...',
    shortcutHint: '/ 키로 검색',
    clear: '지우기',
  },
} as const;

export type SearchBarTheme = 'dark' | 'light';

export interface SearchBarBaseProps {
  theme: SearchBarTheme;
  locale: string;
  onActressSearch: (query: string) => void;
  onProductSearch: (query: string) => Promise<void>;
}

const themeStyles = {
  dark: {
    input: 'bg-gray-800 text-white border-gray-700 focus:ring-rose-500',
    shortcutBg: 'bg-gray-700 text-gray-400',
    shortcutText: 'text-gray-500',
    clearHover: 'hover:text-white',
    spinnerBorder: 'border-white',
  },
  light: {
    input: 'bg-white text-gray-900 border-gray-300 focus:ring-pink-500 placeholder:text-gray-400',
    shortcutBg: 'bg-gray-100 text-gray-500 border border-gray-200',
    shortcutText: 'text-gray-400',
    clearHover: 'hover:text-gray-700',
    spinnerBorder: 'border-gray-700',
  },
};

export function SearchBarBase({ theme, locale, onActressSearch, onProductSearch }: SearchBarBaseProps) {
  const [actressQuery, setActressQuery] = useState('');
  const [productQuery, setProductQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showShortcutHint, setShowShortcutHint] = useState(true);

  const t = searchBarTranslations[locale as keyof typeof searchBarTranslations] || searchBarTranslations.ja;
  const styles = themeStyles[theme];

  const actressInputRef = useRef<HTMLInputElement>(null);
  const actressDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const productDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Keyboard shortcut (/ key to focus search)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (e.key === '/') {
        e.preventDefault();
        actressInputRef.current?.focus();
        setShowShortcutHint(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Actress search handler with debounce
  const handleActressChange = useCallback((value: string) => {
    setActressQuery(value);

    if (actressDebounceRef.current) {
      clearTimeout(actressDebounceRef.current);
    }

    actressDebounceRef.current = setTimeout(() => {
      if (value.trim().length >= 2) {
        onActressSearch(value.trim());
      }
    }, 500);
  }, [onActressSearch]);

  // Product search handler with debounce
  const handleProductChange = useCallback((value: string) => {
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
  }, [onProductSearch]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (actressDebounceRef.current) clearTimeout(actressDebounceRef.current);
      if (productDebounceRef.current) clearTimeout(productDebounceRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col sm:flex-row gap-2">
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
          className={`w-full px-4 py-2 pl-10 pr-8 rounded-lg border focus:outline-none focus:ring-2 focus:border-transparent text-sm ${styles.input}`}
        />
        {/* Keyboard shortcut hint */}
        {showShortcutHint && !actressQuery && (
          <span className={`hidden sm:flex absolute right-3 top-1/2 transform -translate-y-1/2 items-center gap-1 text-xs ${styles.shortcutText} pointer-events-none`}>
            <kbd className={`px-1.5 py-0.5 rounded font-mono ${styles.shortcutBg}`}>/</kbd>
          </span>
        )}
        <svg
          className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
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
            className={`absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 ${styles.clearHover} transition-colors`}
            aria-label={t.clear}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          className={`w-full px-4 py-2 pl-10 pr-8 rounded-lg border focus:outline-none focus:ring-2 focus:border-transparent text-sm disabled:opacity-50 ${styles.input}`}
        />
        <svg
          className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
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
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className={`animate-spin rounded-full h-4 w-4 border-b-2 ${styles.spinnerBorder}`}></div>
          </div>
        ) : productQuery && (
          <button
            type="button"
            onClick={() => setProductQuery('')}
            className={`absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 ${styles.clearHover} transition-colors`}
            aria-label={t.clear}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
