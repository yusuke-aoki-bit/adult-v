'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Search, X } from 'lucide-react';
import { useDebounce } from '@adult-v/shared/hooks';
import { normalizeImageUrl } from '@adult-v/shared/lib/image-utils';

// Client-side translations
const translations = {
  ja: {
    placeholder: '作品・女優・ジャンル・品番で検索...',
    searching: '検索中...',
    videos: '作品',
    recentSearches: '最近の検索',
    clearHistory: 'クリア',
    categories: {
      productId: '品番',
      actress: '女優',
      tag: 'タグ',
      genre: 'ジャンル',
      product: '作品',
    },
  },
  en: {
    placeholder: 'Search products, actresses, genres, IDs...',
    searching: 'Searching...',
    videos: 'videos',
    recentSearches: 'Recent Searches',
    clearHistory: 'Clear',
    categories: {
      productId: 'ID',
      actress: 'Actress',
      tag: 'Tag',
      genre: 'Genre',
      product: 'Product',
    },
  },
  zh: {
    placeholder: '搜索作品、女优、类型、编号...',
    searching: '搜索中...',
    videos: '部作品',
    recentSearches: '最近搜索',
    clearHistory: '清除',
    categories: {
      productId: '编号',
      actress: '女优',
      tag: '标签',
      genre: '类型',
      product: '作品',
    },
  },
  ko: {
    placeholder: '작품, 여배우, 장르, 제품번호 검색...',
    searching: '검색 중...',
    videos: '개 작품',
    recentSearches: '최근 검색',
    clearHistory: '삭제',
    categories: {
      productId: '제품번호',
      actress: '여배우',
      tag: '태그',
      genre: '장르',
      product: '작품',
    },
  },
} as const;

const RECENT_SEARCHES_KEY = 'adult-v-recent-searches';
const MAX_RECENT_SEARCHES = 5;

interface AutocompleteResult {
  type: 'product' | 'actress' | 'tag' | 'product_id';
  id: string | number;
  name: string;
  image?: string;
  category?: string;
  count?: number;
}

interface SearchAutocompleteProps {
  locale: string;
  placeholder?: string;
  className?: string;
}

export default function SearchAutocomplete({
  locale,
  placeholder,
  className = '',
}: SearchAutocompleteProps) {
  const t = translations[locale as keyof typeof translations] || translations.ja;
  const resolvedPlaceholder = placeholder || t.placeholder;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AutocompleteResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showRecentSearches, setShowRecentSearches] = useState(false);
  const debouncedQuery = useDebounce(query, 300);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Save recent search
  const saveRecentSearch = useCallback((searchQuery: string) => {
    const trimmed = searchQuery.trim();
    if (!trimmed || trimmed.length < 2) return;

    setRecentSearches((prev) => {
      const updated = [trimmed, ...prev.filter((s) => s !== trimmed)].slice(0, MAX_RECENT_SEARCHES);
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      } catch {
        // Ignore localStorage errors
      }
      return updated;
    });
  }, []);

  // Clear recent searches
  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {
      // Ignore
    }
  }, []);

  // Fetch autocomplete results
  useEffect(() => {
    if (debouncedQuery.length < 2) {
      // Reset state when query is too short - this is intentional cleanup
      const resetState = () => {
        setResults([]);
        setIsOpen(false);
      };
      resetState();
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);

    fetch(`/api/search/autocomplete?q=${encodeURIComponent(debouncedQuery)}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error('fetch failed');
        return res.json();
      })
      .then((data) => {
        setResults(data.results || []);
        setIsOpen(true);
        setSelectedIndex(-1);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setResults([]);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [debouncedQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleResultClick = useCallback(
    (result: AutocompleteResult) => {
      setIsOpen(false);
      setShowRecentSearches(false);
      saveRecentSearch(result.name);
      setQuery('');

      switch (result.type) {
        case 'product':
        case 'product_id':
          router.push(`/${locale}/products/${result.id}`);
          break;
        case 'actress':
          router.push(`/${locale}/actress/${result.id}`);
          break;
        case 'tag':
          router.push(`/${locale}/search?tags=${result.id}`);
          break;
      }
    },
    [locale, router, saveRecentSearch]
  );

  // Handle recent search click
  const handleRecentSearchClick = useCallback(
    (searchQuery: string) => {
      setQuery(searchQuery);
      setShowRecentSearches(false);
      router.push(`/${locale}/search?q=${encodeURIComponent(searchQuery)}`);
    },
    [locale, router]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) {
      if (e.key === 'Enter' && query) {
        // Direct search on Enter without selection
        saveRecentSearch(query);
        router.push(`/${locale}/search?q=${encodeURIComponent(query)}`);
        setIsOpen(false);
        setShowRecentSearches(false);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          handleResultClick(results[selectedIndex]);
        } else if (query) {
          saveRecentSearch(query);
          router.push(`/${locale}/search?q=${encodeURIComponent(query)}`);
          setIsOpen(false);
          setShowRecentSearches(false);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setShowRecentSearches(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    setShowRecentSearches(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  // Clock icon for recent searches
  const ClockIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
    </svg>
  );

  const getCategoryColor = (category?: string) => {
    switch (category) {
      case '品番':
        return 'bg-blue-600';
      case '女優':
        return 'bg-rose-600';
      case 'タグ':
      case 'ジャンル':
        return 'bg-purple-600';
      case '作品':
        return 'bg-green-600';
      default:
        return 'bg-gray-600';
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) {
              setIsOpen(true);
            } else if (query.length < 2 && recentSearches.length > 0) {
              setShowRecentSearches(true);
            }
          }}
          placeholder={resolvedPlaceholder}
          className="block w-full pl-10 pr-10 py-2 border border-gray-600 rounded-lg bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Recent searches dropdown */}
      {showRecentSearches && !isOpen && recentSearches.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-2 bg-gray-800 border border-gray-700 rounded-lg shadow-xl"
        >
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
            <span className="text-sm text-gray-400">{t.recentSearches}</span>
            <button
              onClick={clearRecentSearches}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              {t.clearHistory}
            </button>
          </div>
          {recentSearches.map((search, index) => (
            <div
              key={index}
              onClick={() => handleRecentSearchClick(search)}
              className="px-4 py-3 cursor-pointer hover:bg-gray-700 transition-colors flex items-center gap-3"
            >
              <ClockIcon />
              <span className="text-white truncate">{search}</span>
            </div>
          ))}
        </div>
      )}

      {/* Autocomplete results dropdown */}
      {isOpen && (results.length > 0 || isLoading) && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-2 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-96 overflow-y-auto"
        >
          {isLoading ? (
            <div className="px-4 py-3 text-center text-gray-400">
              {t.searching}
            </div>
          ) : (
            results.map((result, index) => (
              <div
                key={`${result.type}-${result.id}`}
                onClick={() => handleResultClick(result)}
                className={`px-4 py-3 cursor-pointer transition-colors flex items-center gap-3 ${
                  index === selectedIndex
                    ? 'bg-gray-700'
                    : 'hover:bg-gray-700'
                } ${index > 0 ? 'border-t border-gray-700' : ''}`}
              >
                {result.image && (
                  <div className="shrink-0">
                    <Image
                      src={normalizeImageUrl(result.image)}
                      alt={result.name}
                      width={48}
                      height={48}
                      className="rounded object-cover"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {result.category && (
                      <span
                        className={`px-2 py-0.5 text-xs font-semibold text-white rounded ${getCategoryColor(
                          result.category
                        )}`}
                      >
                        {result.category}
                      </span>
                    )}
                    <span className="text-white truncate">{result.name}</span>
                  </div>
                  {result.count !== undefined && (
                    <div className="text-xs text-gray-400 mt-1">
                      {result.count}{t.videos}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
