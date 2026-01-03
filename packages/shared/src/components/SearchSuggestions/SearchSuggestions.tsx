'use client';

import { useState, useEffect, useCallback } from 'react';

// Translations
const translations = {
  ja: {
    relatedTerms: '関連キーワード',
    suggestedFilters: 'おすすめフィルター',
    expandedQuery: '検索拡張',
    loading: '分析中...',
    genres: 'ジャンル',
    performers: '出演者',
  },
  en: {
    relatedTerms: 'Related Keywords',
    suggestedFilters: 'Suggested Filters',
    expandedQuery: 'Enhanced Search',
    loading: 'Analyzing...',
    genres: 'Genres',
    performers: 'Performers',
  },
  zh: {
    relatedTerms: '相关关键词',
    suggestedFilters: '推荐筛选',
    expandedQuery: '搜索扩展',
    loading: '分析中...',
    genres: '类型',
    performers: '演员',
  },
  ko: {
    relatedTerms: '관련 키워드',
    suggestedFilters: '추천 필터',
    expandedQuery: '검색 확장',
    loading: '분석 중...',
    genres: '장르',
    performers: '출연자',
  },
} as const;

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
  theme = 'dark',
}: SearchSuggestionsProps) {
  const [analysis, setAnalysis] = useState<SearchAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const t = translations[locale as keyof typeof translations] || translations.ja;

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
        <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
        {t.loading}
      </div>
    );
  }

  if (!analysis) return null;

  const hasRelatedTerms = analysis.relatedTerms && analysis.relatedTerms.length > 0;
  const hasGenres = analysis.genres && analysis.genres.length > 0;
  const hasPerformers = analysis.performers && analysis.performers.length > 0;
  const hasSuggestedGenres = analysis.suggestedFilters?.includeGenres && analysis.suggestedFilters.includeGenres.length > 0;

  if (!hasRelatedTerms && !hasGenres && !hasPerformers && !hasSuggestedGenres) return null;

  const baseChipClass = theme === 'dark'
    ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
    : 'bg-gray-100 hover:bg-gray-200 text-gray-700';

  const genreChipClass = theme === 'dark'
    ? 'bg-rose-900/50 hover:bg-rose-800/50 text-rose-200'
    : 'bg-rose-100 hover:bg-rose-200 text-rose-700';

  const performerChipClass = theme === 'dark'
    ? 'bg-purple-900/50 hover:bg-purple-800/50 text-purple-200'
    : 'bg-purple-100 hover:bg-purple-200 text-purple-700';

  return (
    <div className={`rounded-lg p-3 ${theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50'}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex items-center justify-between w-full text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}
      >
        <span className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          {t.expandedQuery}
        </span>
        <svg
          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
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
              <div className={`text-xs mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                {t.relatedTerms}
              </div>
              <div className="flex flex-wrap gap-2">
                {analysis.relatedTerms.map((term, i) => (
                  <button
                    key={i}
                    onClick={() => onTermClick?.(term)}
                    className={`px-3 py-1 text-sm rounded-full transition-colors ${baseChipClass}`}
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
              <div className={`text-xs mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                {t.performers}
              </div>
              <div className="flex flex-wrap gap-2">
                {analysis.performers.map((performer, i) => (
                  <button
                    key={i}
                    onClick={() => onPerformerClick?.(performer)}
                    className={`px-3 py-1 text-sm rounded-full transition-colors flex items-center gap-1 ${performerChipClass}`}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
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
              <div className={`text-xs mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                {t.genres}
              </div>
              <div className="flex flex-wrap gap-2">
                {(analysis.suggestedFilters?.includeGenres || analysis.genres).map((genre, i) => (
                  <button
                    key={i}
                    onClick={() => onGenreClick?.(genre)}
                    className={`px-3 py-1 text-sm rounded-full transition-colors flex items-center gap-1 ${genreChipClass}`}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
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
