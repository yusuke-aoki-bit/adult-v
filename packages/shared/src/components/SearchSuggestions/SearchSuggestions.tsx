'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSiteTheme } from '../../contexts/SiteThemeContext';
import { getTranslation, searchSuggestionsTranslations } from '../../lib/translations';

interface SearchAnalysis {
  performers: string[];
  genres: string[];
  keywords: string[];
  intent: string;
  expandedQuery: string;
  relatedTerms: string[];
  suggestedFilters: {
    includeGenres?: string[];
    excludeGenres?: string[];
  };
}

interface SearchSuggestionsProps {
  query: string;
  locale?: string;
  onTermClick?: (term: string) => void;
  onGenreClick?: (genre: string) => void;
  onPerformerClick?: (performer: string) => void;
  apiEndpoint?: string;
  theme?: 'dark' | 'light';
}

export function SearchSuggestions({
  query,
  locale = 'ja',
  onTermClick,
  onGenreClick,
  onPerformerClick,
  apiEndpoint = '/api/search/analyze',
  theme: themeProp,
}: SearchSuggestionsProps) {
  const { theme: contextTheme } = useSiteTheme();
  const theme = themeProp ?? contextTheme;
  const [analysis, setAnalysis] = useState<SearchAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const t = getTranslation(searchSuggestionsTranslations, locale);

  const fetchAnalysis = useCallback(async () => {
    if (!query || query.length < 2) {
      setAnalysis(null);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      if (response.ok) {
        const data = await response.json();
        setAnalysis(data);
      }
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  }, [query, apiEndpoint]);

  useEffect(() => {
    const timer = setTimeout(fetchAnalysis, 1000);
    return () => clearTimeout(timer);
  }, [fetchAnalysis]);

  if (!query || query.length < 2) return null;
  if (isLoading) {
    return (
      <div className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'} flex items-center gap-2`}>
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        {t.loading}
      </div>
    );
  }

  if (!analysis) return null;

  const hasRelatedTerms = analysis.relatedTerms && analysis.relatedTerms.length > 0;
  const hasGenres = analysis.genres && analysis.genres.length > 0;
  const hasPerformers = analysis.performers && analysis.performers.length > 0;
  const hasSuggestedGenres =
    analysis.suggestedFilters?.includeGenres && analysis.suggestedFilters.includeGenres.length > 0;

  if (!hasRelatedTerms && !hasGenres && !hasPerformers && !hasSuggestedGenres) return null;

  const baseChipClass =
    theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700';

  const genreChipClass =
    theme === 'dark'
      ? 'bg-rose-900/50 hover:bg-rose-800/50 text-rose-200'
      : 'bg-rose-100 hover:bg-rose-200 text-rose-700';

  const performerChipClass =
    theme === 'dark'
      ? 'bg-purple-900/50 hover:bg-purple-800/50 text-purple-200'
      : 'bg-purple-100 hover:bg-purple-200 text-purple-700';

  return (
    <div className={`rounded-lg p-3 ${theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50'}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex w-full items-center justify-between text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}
      >
        <span className="flex items-center gap-2">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
          {t.expandedQuery}
        </span>
        <svg
          className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-3">
          {/* Related terms */}
          {hasRelatedTerms && (
            <div>
              <div className={`mb-2 text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                {t.relatedTerms}
              </div>
              <div className="flex flex-wrap gap-2">
                {analysis.relatedTerms.map((term, i) => (
                  <button
                    key={i}
                    onClick={() => onTermClick?.(term)}
                    className={`rounded-full px-3 py-1 text-sm transition-colors ${baseChipClass}`}
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Extracted performers */}
          {hasPerformers && (
            <div>
              <div className={`mb-2 text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                {t.performers}
              </div>
              <div className="flex flex-wrap gap-2">
                {analysis.performers.map((performer, i) => (
                  <button
                    key={i}
                    onClick={() => onPerformerClick?.(performer)}
                    className={`flex items-center gap-1 rounded-full px-3 py-1 text-sm transition-colors ${performerChipClass}`}
                  >
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                    {performer}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Extracted/Suggested genres */}
          {(hasGenres || hasSuggestedGenres) && (
            <div>
              <div className={`mb-2 text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{t.genres}</div>
              <div className="flex flex-wrap gap-2">
                {(analysis.suggestedFilters?.includeGenres || analysis.genres).map((genre, i) => (
                  <button
                    key={i}
                    onClick={() => onGenreClick?.(genre)}
                    className={`flex items-center gap-1 rounded-full px-3 py-1 text-sm transition-colors ${genreChipClass}`}
                  >
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                      />
                    </svg>
                    {genre}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
