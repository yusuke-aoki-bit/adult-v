'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Search, Sparkles, X, Loader2, MessageSquare, ChevronRight } from 'lucide-react';
import { localizedHref } from '../i18n';
import { useSiteTheme } from '../contexts/SiteThemeContext';
import { getTranslation, naturalLanguageSearchTranslations, searchSuggestionsData } from '../lib/translations';

const RECENT_SEARCHES_KEY = 'adult-v-recent-scene-searches';

interface SearchResult {
  id: string;
  title: string;
  imageUrl: string | null;
  matchText: string;
}

interface ProductApiResponse {
  id: number | string;
  title: string;
  imageUrl?: string | null;
  description?: string | null;
}

interface NaturalLanguageSearchProps {
  locale: string;
  className?: string;
}

export default function NaturalLanguageSearch({ locale, className = '' }: NaturalLanguageSearchProps) {
  const { theme } = useSiteTheme();
  const isDark = theme === 'dark';
  const t = getTranslation(naturalLanguageSearchTranslations, locale);
  const suggestions = searchSuggestionsData[locale as keyof typeof searchSuggestionsData] || searchSuggestionsData.ja;

  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load recent searches
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

  const saveRecentSearch = (searchQuery: string) => {
    const updated = [searchQuery, ...recentSearches.filter((s) => s !== searchQuery)].slice(0, 5);
    setRecentSearches(updated);
    try {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch {
      // Ignore localStorage errors
    }
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {
      // Ignore
    }
  };

  const handleSearch = async (searchQuery?: string) => {
    const q = searchQuery || query;
    if (!q.trim()) return;

    setIsLoading(true);
    setHasSearched(true);
    saveRecentSearch(q.trim());

    try {
      // Search by description/title using existing search API
      const params = new URLSearchParams();
      params.set('query', q.trim());
      params.set('limit', '12');

      const response = await fetch(`/api/products?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        // Transform results to include match text
        const searchResults = (data.products || []).map((p: ProductApiResponse) => ({
          id: String(p.id),
          title: p.title,
          imageUrl: p.imageUrl || null,
          matchText: p.description?.slice(0, 100) || p.title,
        }));
        setResults(searchResults);
      }
    } catch (error) {
      console.error('Error searching:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className={`${isDark ? 'bg-gray-800' : 'bg-white shadow'} rounded-lg p-4 ${className}`}>
      {/* Header */}
      <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'} mb-4 flex items-center gap-2`}>
        <MessageSquare className={`h-5 w-5 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
        {t.title}
      </h3>

      {/* Search Input */}
      <div className="relative mb-4">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t.placeholder}
          className={`w-full px-4 py-3 pl-10 ${isDark ? 'bg-gray-750 border-gray-600 text-white placeholder:text-gray-500' : 'border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400'} rounded-lg border focus:border-blue-500 focus:outline-none`}
        />
        <Search
          className={`absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className={`absolute top-1/2 right-3 -translate-y-1/2 ${isDark ? 'text-gray-500 hover:text-white' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Search Button */}
      <button
        onClick={() => handleSearch()}
        disabled={isLoading || !query.trim()}
        className={`w-full py-2 ${isDark ? 'bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600' : 'bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300'} mb-4 flex items-center justify-center gap-2 rounded-lg text-white transition-colors disabled:cursor-not-allowed`}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {t.searching}
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            {t.search}
          </>
        )}
      </button>

      {/* Results */}
      {hasSearched && !isLoading && (
        <div className="mb-4">
          {results.length > 0 ? (
            <>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-3`}>
                {results.length}
                {t.results}
              </p>
              <div className="max-h-60 space-y-2 overflow-y-auto">
                {results.slice(0, 6).map((result) => (
                  <Link
                    key={result.id}
                    href={localizedHref(`/products/${result.id}`, locale)}
                    className={`flex items-center gap-3 p-2 ${isDark ? 'bg-gray-750 hover:bg-gray-700' : 'bg-gray-50 hover:bg-gray-100'} group rounded-lg transition-colors`}
                  >
                    <div
                      className={`h-14 w-10 shrink-0 overflow-hidden rounded ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}
                    >
                      {result.imageUrl ? (
                        <img src={result.imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Search className={`h-4 w-4 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm ${isDark ? 'text-white group-hover:text-blue-400' : 'text-gray-700 group-hover:text-blue-500'} truncate transition-colors`}
                      >
                        {result.title}
                      </p>
                    </div>
                    <ChevronRight
                      className={`h-4 w-4 ${isDark ? 'text-gray-600 group-hover:text-gray-400' : 'text-gray-300 group-hover:text-gray-500'} shrink-0`}
                    />
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <div className="py-4 text-center">
              <p className={`${isDark ? 'text-gray-400' : 'text-gray-500'} mb-1`}>{t.noResults}</p>
              <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{t.tryDifferent}</p>
            </div>
          )}
        </div>
      )}

      {/* Recent Searches */}
      {!hasSearched && recentSearches.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t.recentSearches}</p>
            <button
              onClick={clearRecentSearches}
              className={`text-xs ${isDark ? 'text-gray-500 hover:text-gray-400' : 'text-gray-400 hover:text-gray-600'}`}
            >
              {t.clear}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {recentSearches.map((search, index) => (
              <button
                key={index}
                onClick={() => {
                  setQuery(search);
                  handleSearch(search);
                }}
                className={`px-3 py-1.5 ${isDark ? 'bg-gray-750 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'} rounded-full text-sm transition-colors`}
              >
                {search}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions */}
      {!hasSearched && (
        <div>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-2`}>{t.suggestions}</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => {
                  setQuery(suggestion);
                  handleSearch(suggestion);
                }}
                className={`px-3 py-1.5 ${isDark ? 'bg-blue-900/30 text-blue-300 hover:bg-blue-900/50' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'} rounded-full text-sm transition-colors`}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
