'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Search, Sparkles, X, Loader2, MessageSquare, ChevronRight } from 'lucide-react';

const translations = {
  ja: {
    title: '自然言語で検索',
    placeholder: 'シーンを説明してください（例：「プールで始まるやつ」）',
    search: '検索',
    searching: '検索中...',
    results: '件の結果',
    noResults: '該当する作品が見つかりませんでした',
    tryDifferent: '別の言葉で試してください',
    suggestions: '検索例',
    recentSearches: '最近の検索',
    clear: 'クリア',
  },
  en: {
    title: 'Natural Language Search',
    placeholder: 'Describe the scene (e.g., "starts at a pool")',
    search: 'Search',
    searching: 'Searching...',
    results: ' results',
    noResults: 'No matching products found',
    tryDifferent: 'Try different words',
    suggestions: 'Suggestions',
    recentSearches: 'Recent Searches',
    clear: 'Clear',
  },
  zh: {
    title: '自然语言搜索',
    placeholder: '描述场景（例："在泳池开始的"）',
    search: '搜索',
    searching: '搜索中...',
    results: '个结果',
    noResults: '未找到匹配的作品',
    tryDifferent: '尝试其他关键词',
    suggestions: '搜索示例',
    recentSearches: '最近搜索',
    clear: '清除',
  },
  ko: {
    title: '자연어 검색',
    placeholder: '장면을 설명하세요 (예: "수영장에서 시작하는")',
    search: '검색',
    searching: '검색 중...',
    results: '개 결과',
    noResults: '일치하는 작품을 찾을 수 없습니다',
    tryDifferent: '다른 단어로 시도해보세요',
    suggestions: '검색 예시',
    recentSearches: '최근 검색',
    clear: '삭제',
  },
} as const;

const SEARCH_SUGGESTIONS = {
  ja: [
    'オフィスでのシーン',
    '野外・露出系',
    '制服もの',
    'マッサージ店',
    '温泉・お風呂',
  ],
  en: [
    'Office scenes',
    'Outdoor activities',
    'Uniform themes',
    'Massage parlor',
    'Hot spring / Bath',
  ],
  zh: [
    '办公室场景',
    '户外活动',
    '制服主题',
    '按摩店',
    '温泉/浴室',
  ],
  ko: [
    '사무실 장면',
    '야외 활동',
    '유니폼 테마',
    '마사지샵',
    '온천/목욕',
  ],
};

const RECENT_SEARCHES_KEY = 'adult-v-recent-scene-searches';

interface SearchResult {
  id: string;
  title: string;
  imageUrl: string | null;
  matchText: string;
}

interface NaturalLanguageSearchProps {
  locale: string;
  className?: string;
}

export default function NaturalLanguageSearch({ locale, className = '' }: NaturalLanguageSearchProps) {
  const t = translations[locale as keyof typeof translations] || translations.ja;
  const suggestions = SEARCH_SUGGESTIONS[locale as keyof typeof SEARCH_SUGGESTIONS] || SEARCH_SUGGESTIONS.ja;

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
    const updated = [searchQuery, ...recentSearches.filter(s => s !== searchQuery)].slice(0, 5);
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
        const searchResults = (data.products || []).map((p: any) => ({
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
    <div className={`bg-gray-800 rounded-lg p-4 ${className}`}>
      {/* Header */}
      <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
        <MessageSquare className="w-5 h-5 text-blue-400" />
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
          className="w-full px-4 py-3 pl-10 bg-gray-750 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none placeholder:text-gray-500"
        />
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Search Button */}
      <button
        onClick={() => handleSearch()}
        disabled={isLoading || !query.trim()}
        className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg flex items-center justify-center gap-2 transition-colors mb-4"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {t.searching}
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            {t.search}
          </>
        )}
      </button>

      {/* Results */}
      {hasSearched && !isLoading && (
        <div className="mb-4">
          {results.length > 0 ? (
            <>
              <p className="text-sm text-gray-400 mb-3">
                {results.length}{t.results}
              </p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {results.slice(0, 6).map(result => (
                  <Link
                    key={result.id}
                    href={`/${locale}/products/${result.id}`}
                    className="flex items-center gap-3 p-2 bg-gray-750 rounded-lg hover:bg-gray-700 transition-colors group"
                  >
                    <div className="w-10 h-14 flex-shrink-0 rounded overflow-hidden bg-gray-700">
                      {result.imageUrl ? (
                        <img
                          src={result.imageUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Search className="w-4 h-4 text-gray-600" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white group-hover:text-blue-400 truncate transition-colors">
                        {result.title}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 flex-shrink-0" />
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-gray-400 mb-1">{t.noResults}</p>
              <p className="text-sm text-gray-500">{t.tryDifferent}</p>
            </div>
          )}
        </div>
      )}

      {/* Recent Searches */}
      {!hasSearched && recentSearches.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-400">{t.recentSearches}</p>
            <button
              onClick={clearRecentSearches}
              className="text-xs text-gray-500 hover:text-gray-400"
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
                className="px-3 py-1.5 bg-gray-750 hover:bg-gray-700 text-gray-300 text-sm rounded-full transition-colors"
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
          <p className="text-sm text-gray-400 mb-2">{t.suggestions}</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => {
                  setQuery(suggestion);
                  handleSearch(suggestion);
                }}
                className="px-3 py-1.5 bg-blue-900/30 hover:bg-blue-900/50 text-blue-300 text-sm rounded-full transition-colors"
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
