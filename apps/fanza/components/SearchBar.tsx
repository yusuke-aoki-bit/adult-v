'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';

// Client-side translations (ConditionalLayout is outside NextIntlClientProvider)
const translations = {
  ja: {
    actressPlaceholder: '女優名・プロフィールで検索...',
    productPlaceholder: '作品名・作品ID・説明文で検索...',
    shortcutHint: '/ キーで検索',
  },
  en: {
    actressPlaceholder: 'Search by actress name or profile...',
    productPlaceholder: 'Search by title, product ID, or description...',
    shortcutHint: 'Press / to search',
  },
  zh: {
    actressPlaceholder: '按女优名称或简介搜索...',
    productPlaceholder: '按标题、产品ID或描述搜索...',
    shortcutHint: '按 / 键搜索',
  },
  ko: {
    actressPlaceholder: '여배우 이름 또는 프로필로 검색...',
    productPlaceholder: '제목, 제품 ID 또는 설명으로 검색...',
    shortcutHint: '/ 키로 검색',
  },
} as const;

export default function SearchBar() {
  const [actressQuery, setActressQuery] = useState('');
  const [productQuery, setProductQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showShortcutHint, setShowShortcutHint] = useState(true);
  const router = useRouter();
  const params = useParams();
  const locale = (params.locale as string) || 'ja';
  const t = translations[locale as keyof typeof translations] || translations.ja;

  // 検索入力への参照
  const actressInputRef = useRef<HTMLInputElement>(null);
  const productInputRef = useRef<HTMLInputElement>(null);

  // デバウンス用のタイマー
  const actressDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const productDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // キーボードショートカット（/ キーで検索にフォーカス）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 入力中は無視
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // / キーで女優検索にフォーカス
      if (e.key === '/') {
        e.preventDefault();
        actressInputRef.current?.focus();
        setShowShortcutHint(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 女優名検索（デバウンス付き）
  const executeActressSearch = useCallback((query: string) => {
    if (query.trim().length >= 2) {
      router.push(`/${locale}/?q=${encodeURIComponent(query.trim())}`);
    }
  }, [router, locale]);

  // 作品検索（デバウンス付き）
  const executeProductSearch = useCallback(async (query: string) => {
    if (query.trim().length < 2) return;

    setIsSearching(true);

    try {
      // まず商品ID/メーカー品番で検索
      const response = await fetch(`/api/products/search-by-id?productId=${encodeURIComponent(query.trim())}`);

      if (response.ok) {
        const data = await response.json();
        if (data.product) {
          router.push(`/${locale}/products/${data.product.id}`);
          setProductQuery('');
          setIsSearching(false);
          return;
        }
      }

      // 商品IDで見つからない場合は、作品名で検索
      router.push(`/${locale}/search?q=${encodeURIComponent(query.trim())}&type=products`);
    } catch (error) {
      console.error('Search error:', error);
      router.push(`/${locale}/search?q=${encodeURIComponent(query.trim())}&type=products`);
    } finally {
      setIsSearching(false);
    }
  }, [router, locale]);

  // 女優名入力時のハンドラ（デバウンス300ms）
  const handleActressChange = (value: string) => {
    setActressQuery(value);

    if (actressDebounceRef.current) {
      clearTimeout(actressDebounceRef.current);
    }

    actressDebounceRef.current = setTimeout(() => {
      executeActressSearch(value);
    }, 500);
  };

  // 作品検索入力時のハンドラ（デバウンス500ms）
  const handleProductChange = (value: string) => {
    setProductQuery(value);

    if (productDebounceRef.current) {
      clearTimeout(productDebounceRef.current);
    }

    productDebounceRef.current = setTimeout(() => {
      executeProductSearch(value);
    }, 700);
  };

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (actressDebounceRef.current) clearTimeout(actressDebounceRef.current);
      if (productDebounceRef.current) clearTimeout(productDebounceRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      {/* 女優名検索 */}
      <div className="relative flex-1">
        <input
          ref={actressInputRef}
          type="text"
          value={actressQuery}
          onChange={(e) => handleActressChange(e.target.value)}
          onFocus={() => setShowShortcutHint(false)}
          placeholder={t.actressPlaceholder}
          aria-label={t.actressPlaceholder}
          className="w-full px-4 py-2 pl-10 pr-8 bg-white text-gray-900 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent text-sm placeholder:text-gray-400"
        />
        {/* キーボードショートカットヒント */}
        {showShortcutHint && !actressQuery && (
          <span className="hidden sm:flex absolute right-3 top-1/2 transform -translate-y-1/2 items-center gap-1 text-xs text-gray-400 pointer-events-none">
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-500 font-mono border border-gray-200">/</kbd>
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
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors"
            aria-label="クリア"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* 作品検索（作品名・作品ID・メーカー品番） */}
      <div className="relative flex-1">
        <input
          type="text"
          value={productQuery}
          onChange={(e) => handleProductChange(e.target.value)}
          placeholder={t.productPlaceholder}
          aria-label={t.productPlaceholder}
          disabled={isSearching}
          className="w-full px-4 py-2 pl-10 pr-8 bg-white text-gray-900 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent text-sm placeholder:text-gray-400 disabled:opacity-50"
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
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-pink-500"></div>
          </div>
        ) : productQuery && (
          <button
            type="button"
            onClick={() => setProductQuery('')}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors"
            aria-label="クリア"
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
