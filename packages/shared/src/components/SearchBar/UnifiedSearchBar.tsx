'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { localizedHref } from '../../i18n';

// Translations for UnifiedSearchBar
export const unifiedSearchTranslations = {
  ja: {
    placeholder: '作品・女優・画像で検索...',
    productPlaceholder: '作品名・ID・説明文で検索',
    actressPlaceholder: '女優名・プロフィールで検索',
    imagePlaceholder: '画像URLを貼り付けて類似検索',
    aiPlaceholder: '自然言語で検索（例：明るい雰囲気の巨乳作品）',
    shortcutHint: '/',
    clear: 'クリア',
    modeProduct: '作品',
    modeActress: '女優',
    modeImage: '画像',
    modeAi: 'AI',
    search: '検索',
    dropImageHint: '画像をドロップまたはURLを貼り付け',
    aiAnalyzing: 'AIが解析中...',
  },
  en: {
    placeholder: 'Search products, actresses, images...',
    productPlaceholder: 'Search by title, ID, description',
    actressPlaceholder: 'Search by actress name, profile',
    imagePlaceholder: 'Paste image URL for similar search',
    aiPlaceholder: 'Search with natural language (e.g., busty with bright atmosphere)',
    shortcutHint: '/',
    clear: 'Clear',
    modeProduct: 'Product',
    modeActress: 'Actress',
    modeImage: 'Image',
    modeAi: 'AI',
    search: 'Search',
    dropImageHint: 'Drop image or paste URL',
    aiAnalyzing: 'AI analyzing...',
  },
  zh: {
    placeholder: '搜索作品、女优、图片...',
    productPlaceholder: '按标题、ID、描述搜索',
    actressPlaceholder: '按女优名、简介搜索',
    imagePlaceholder: '粘贴图片URL进行相似搜索',
    aiPlaceholder: '用自然语言搜索（例：氛围明亮的巨乳作品）',
    shortcutHint: '/',
    clear: '清除',
    modeProduct: '作品',
    modeActress: '女优',
    modeImage: '图片',
    modeAi: 'AI',
    search: '搜索',
    dropImageHint: '拖放图片或粘贴URL',
    aiAnalyzing: 'AI分析中...',
  },
  ko: {
    placeholder: '작품, 여배우, 이미지 검색...',
    productPlaceholder: '제목, ID, 설명으로 검색',
    actressPlaceholder: '여배우 이름, 프로필로 검색',
    imagePlaceholder: '이미지 URL을 붙여넣어 유사 검색',
    aiPlaceholder: '자연어로 검색 (예: 밝은 분위기의 거유 작품)',
    shortcutHint: '/',
    clear: '지우기',
    modeProduct: '작품',
    modeActress: '여배우',
    modeImage: '이미지',
    modeAi: 'AI',
    search: '검색',
    dropImageHint: '이미지를 드롭하거나 URL을 붙여넣기',
    aiAnalyzing: 'AI 분석 중...',
  },
} as const;

export type SearchMode = 'product' | 'actress' | 'image' | 'ai';
export type SearchBarTheme = 'dark' | 'light';

export interface UnifiedSearchBarProps {
  theme: SearchBarTheme;
  locale: string;
  onActressSearch: (query: string) => void;
  onProductSearch: (query: string) => Promise<void>;
  /** コンパクトモード（モバイル用） */
  compact?: boolean;
}

const themeStyles = {
  dark: {
    container: 'bg-gray-800 border-gray-700',
    input: 'bg-transparent text-white placeholder:text-gray-400',
    modeButton: 'text-gray-400 hover:text-white hover:bg-gray-700',
    modeButtonActive: 'text-white bg-rose-600',
    shortcutBg: 'bg-gray-700 text-gray-400',
    clearHover: 'hover:text-white',
    spinnerBorder: 'border-white',
    dropdown: 'bg-gray-800 border-gray-700',
  },
  light: {
    container: 'bg-white border-gray-300',
    input: 'bg-transparent text-gray-900 placeholder:text-gray-400',
    modeButton: 'text-gray-500 hover:text-gray-700 hover:bg-gray-100',
    modeButtonActive: 'text-white bg-rose-500',
    shortcutBg: 'bg-gray-100 text-gray-500 border border-gray-200',
    clearHover: 'hover:text-gray-700',
    spinnerBorder: 'border-gray-700',
    dropdown: 'bg-white border-gray-200',
  },
};

// 検索モードアイコン
const ModeIcons = {
  product: (
    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
      <path d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
    </svg>
  ),
  actress: (
    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
    </svg>
  ),
  image: (
    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
    </svg>
  ),
  ai: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
};

export function UnifiedSearchBar({
  theme,
  locale,
  onActressSearch,
  onProductSearch,
  compact = false,
}: UnifiedSearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('product');
  const [isSearching, setIsSearching] = useState(false);
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [showShortcutHint, setShowShortcutHint] = useState(true);

  const t = unifiedSearchTranslations[locale as keyof typeof unifiedSearchTranslations] || unifiedSearchTranslations.ja;
  const styles = themeStyles[theme];

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // プレースホルダーを現在のモードに応じて変更
  const getPlaceholder = () => {
    switch (mode) {
      case 'product':
        return t.productPlaceholder;
      case 'actress':
        return t.actressPlaceholder;
      case 'image':
        return t.imagePlaceholder;
      case 'ai':
        return t.aiPlaceholder;
      default:
        return t.placeholder;
    }
  };

  // キーボードショートカット
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInputElement = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // Ctrl+K / Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setShowShortcutHint(false);
        return;
      }

      // / キー（入力欄では無効）
      if (!isInputElement && e.key === '/') {
        e.preventDefault();
        inputRef.current?.focus();
        setShowShortcutHint(false);
      }

      // Tab キーでモード切り替え（検索バーにフォーカス中）
      if (document.activeElement === inputRef.current && e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        const modes: SearchMode[] = ['product', 'actress', 'image', 'ai'];
        const currentIndex = modes.indexOf(mode);
        const nextIndex = (currentIndex + 1) % modes.length;
        setMode(modes[nextIndex]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode]);

  // 外部クリックでモードセレクタを閉じる
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowModeSelector(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 検索実行
  const executeSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      switch (mode) {
        case 'product':
          await onProductSearch(searchQuery.trim());
          break;
        case 'actress':
          onActressSearch(searchQuery.trim());
          break;
        case 'image':
          // 画像検索ページにリダイレクト
          const imageUrl = searchQuery.trim();
          if (imageUrl.startsWith('http')) {
            router.push(localizedHref(`/search/image?url=${encodeURIComponent(imageUrl)}`, locale));
          } else {
            router.push(localizedHref('/search/image', locale));
          }
          break;
        case 'ai':
          // AI検索APIを呼び出し
          try {
            const response = await fetch('/api/search/ai', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query: searchQuery.trim(), locale }),
            });
            if (response.ok) {
              const data = await response.json();
              if (data.success && data.redirect) {
                router.push(data.redirect);
              } else if (data.success && data.searchParams) {
                // 検索パラメータでリダイレクト
                const params = new URLSearchParams();
                Object.entries(data.searchParams).forEach(([key, value]) => {
                  if (Array.isArray(value)) {
                    value.forEach(v => params.append(key, v));
                  } else if (value) {
                    params.set(key, value as string);
                  }
                });
                router.push(localizedHref(`/products?${params.toString()}`, locale));
              }
            }
          } catch (err) {
            console.error('[AI Search] Error:', err);
          }
          break;
      }
    } finally {
      setIsSearching(false);
    }
  }, [mode, onProductSearch, onActressSearch, router, locale]);

  // 入力ハンドラ（デバウンス付き）
  const handleChange = useCallback((value: string) => {
    setQuery(value);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // 画像モードとAIモードの場合はデバウンスなしで即時実行しない（Enterキーで実行）
    if (mode === 'image' || mode === 'ai') return;

    debounceRef.current = setTimeout(async () => {
      if (value.trim().length >= 2) {
        await executeSearch(value);
      }
    }, mode === 'actress' ? 500 : 700);
  }, [mode, executeSearch]);

  // Enterキーで検索実行
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && query.trim()) {
      e.preventDefault();
      executeSearch(query);
    }
  };

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      <div className={`flex items-center rounded-lg border focus-within:ring-2 focus-within:ring-rose-500 focus-within:border-transparent ${styles.container}`}>
        {/* モード切り替えボタン */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowModeSelector(!showModeSelector)}
            className={`flex items-center gap-1 px-2 py-2 rounded-l-lg transition-colors ${styles.modeButtonActive}`}
            title={t[`mode${mode.charAt(0).toUpperCase() + mode.slice(1)}` as keyof typeof t] as string}
          >
            {ModeIcons[mode]}
            {!compact && (
              <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            )}
          </button>

          {/* モードセレクタドロップダウン */}
          {showModeSelector && (
            <div className={`absolute top-full left-0 mt-1 py-1 min-w-[120px] rounded-lg shadow-lg border z-50 ${styles.dropdown}`}>
              {(['product', 'actress', 'image', 'ai'] as SearchMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    setShowModeSelector(false);
                    setQuery('');
                    inputRef.current?.focus();
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                    mode === m ? styles.modeButtonActive : styles.modeButton
                  }`}
                >
                  {ModeIcons[m]}
                  <span>{t[`mode${m.charAt(0).toUpperCase() + m.slice(1)}` as keyof typeof t]}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 検索入力 */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowShortcutHint(false)}
          placeholder={getPlaceholder()}
          aria-label={getPlaceholder()}
          disabled={isSearching}
          className={`flex-1 px-3 py-2 text-sm focus:outline-none disabled:opacity-50 ${styles.input}`}
        />

        {/* ショートカットヒント / クリアボタン / スピナー */}
        <div className="flex items-center pr-2">
          {isSearching ? (
            <div className={`animate-spin rounded-full h-4 w-4 border-b-2 ${styles.spinnerBorder}`} />
          ) : query ? (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className={`p-1 text-gray-400 ${styles.clearHover} transition-colors`}
              aria-label={t.clear}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : showShortcutHint && !compact ? (
            <kbd className={`hidden sm:inline px-1.5 py-0.5 text-xs rounded font-mono ${styles.shortcutBg}`}>
              {t.shortcutHint}
            </kbd>
          ) : null}

          {/* 検索ボタン（画像/AIモードまたはモバイル時） */}
          {(mode === 'image' || mode === 'ai' || compact) && query.trim() && (
            <button
              type="button"
              onClick={() => executeSearch(query)}
              disabled={isSearching}
              className="ml-1 p-1.5 rounded bg-rose-600 text-white hover:bg-rose-700 transition-colors disabled:opacity-50"
              aria-label={t.search}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default UnifiedSearchBar;
