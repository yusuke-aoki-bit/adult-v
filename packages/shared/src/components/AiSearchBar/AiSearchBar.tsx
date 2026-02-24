'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useSiteTheme } from '../../contexts/SiteThemeContext';
import { getTranslation, aiSearchBarTranslations } from '../../lib/translations';

interface AiSearchBarProps {
  locale?: string;
  theme?: 'dark' | 'light';
  onSearch: (params: {
    searchParams: Record<string, string | string[]>;
    redirect?: string;
    message?: string;
    relatedTerms?: string[];
  }) => void;
  apiEndpoint?: string;
}

export function AiSearchBar({
  locale = 'ja',
  theme: themeProp,
  onSearch,
  apiEndpoint = '/api/search/ai',
}: AiSearchBarProps) {
  const { theme: contextTheme } = useSiteTheme();
  const theme = themeProp ?? contextTheme;
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExamples, setShowExamples] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const t = getTranslation(aiSearchBarTranslations, locale);

  const themeStyles =
    theme === 'dark'
      ? {
          container: 'bg-gray-800/80 border-gray-700',
          input: 'bg-transparent text-white placeholder-gray-400',
          badge: 'bg-linear-to-r from-purple-600 to-fuchsia-600 text-white',
          examples: 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50',
          spinner: 'border-white',
        }
      : {
          container: 'bg-white border-gray-300',
          input: 'bg-transparent text-gray-900 placeholder-gray-400',
          badge: 'bg-linear-to-r from-purple-500 to-pink-500 text-white',
          examples: 'bg-gray-100 text-gray-600 hover:bg-gray-200',
          spinner: 'border-gray-700',
        };

  const handleSearch = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim() || searchQuery.trim().length < 3) return;

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: searchQuery.trim(), locale }),
        });

        if (!response.ok) {
          throw new Error('Search failed');
        }

        const data = await response.json();

        if (data.success) {
          onSearch({
            searchParams: data.searchParams || {},
            redirect: data.redirect,
            message: data.message,
            relatedTerms: data.relatedTerms,
          });
        } else {
          setError(data.error || t.error);
        }
      } catch (err) {
        console.error('[AI Search] Error:', err);
        setError(t.error);
      } finally {
        setIsLoading(false);
      }
    },
    [apiEndpoint, locale, onSearch, t.error],
  );

  const handleInputChange = useCallback((value: string) => {
    setQuery(value);
    setError(null);

    // Debounce search
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && query.trim().length >= 3) {
        handleSearch(query);
      }
    },
    [query, handleSearch],
  );

  const handleExampleClick = useCallback(
    (example: string) => {
      setQuery(example);
      setShowExamples(false);
      handleSearch(example);
    },
    [handleSearch],
  );

  // Cleanup
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="relative">
      <div
        className={`relative flex items-center gap-2 rounded-xl border px-4 py-3 ${themeStyles.container} shadow-lg`}
      >
        {/* AI Badge */}
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${themeStyles.badge}`}>
          <span className="flex items-center gap-1">
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
            {t.aiPowered}
          </span>
        </span>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowExamples(true)}
          onBlur={() => setTimeout(() => setShowExamples(false), 200)}
          placeholder={t.placeholder}
          disabled={isLoading}
          className={`flex-1 py-1 text-sm focus:outline-none disabled:opacity-50 ${themeStyles.input}`}
        />

        {/* Loading / Clear / Search button */}
        {isLoading ? (
          <div className="flex items-center gap-2">
            <div className={`h-4 w-4 animate-spin rounded-full border-b-2 ${themeStyles.spinner}`} />
            <span className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{t.analyzing}</span>
          </div>
        ) : (
          <>
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className={`rounded p-1 ${theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-400 hover:text-gray-700'}`}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            <button
              type="button"
              onClick={() => handleSearch(query)}
              disabled={query.trim().length < 3}
              className={`rounded-lg p-2 transition-colors ${
                query.trim().length >= 3
                  ? 'bg-linear-to-r from-purple-600 to-fuchsia-600 text-white hover:from-purple-700 hover:to-fuchsia-700'
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
          </>
        )}
      </div>

      {/* Error message */}
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

      {/* Example queries */}
      {showExamples && !query && (
        <div
          className={`absolute top-full right-0 left-0 mt-2 rounded-lg border p-3 ${
            theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
          } z-50 shadow-lg`}
        >
          <p className={`mb-2 text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>例えば...</p>
          <div className="flex flex-wrap gap-2">
            {t.examples.map((example, i) => (
              <button
                key={i}
                onClick={() => handleExampleClick(example)}
                className={`rounded-full px-3 py-1.5 text-sm transition-colors ${themeStyles.examples}`}
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
