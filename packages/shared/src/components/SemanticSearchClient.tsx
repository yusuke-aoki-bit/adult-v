'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, Loader2, Sparkles, ToggleLeft, ToggleRight } from 'lucide-react';
import { localizedHref } from '../i18n';

interface SearchResult {
  id: number;
  normalizedProductId: string;
  title: string;
  releaseDate: string | null;
  thumbnailUrl: string | null;
  score: number;
  semanticScore?: number;
  keywordScore?: number;
  minPrice: number | null;
  performers: Array<{ id: number; name: string }> | null;
}

interface Props {
  locale: string;
  initialQuery?: string;
  translations: {
    placeholder: string;
    searchButton: string;
    hybridMode: string;
    hybridModeDesc: string;
  };
  isConfigured: boolean;
}

export function SemanticSearchClient({ locale, initialQuery, translations, isConfigured }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery || '');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hybridMode, setHybridMode] = useState(true);
  const [searchMode, setSearchMode] = useState<'semantic' | 'hybrid'>('hybrid');
  const [hasSearched, setHasSearched] = useState(false);

  const t = {
    ja: {
      resultCount: (count: number) => `${count}件の結果`,
      noResults: '検索結果が見つかりませんでした',
      tryDifferent: '別のキーワードで検索してみてください',
      score: '関連度',
      semanticScore: 'AI類似度',
      keywordScore: 'キーワード一致',
      price: '価格',
      yen: '円〜',
      releaseDate: '発売日',
      performers: '出演者',
      viewDetails: '詳細を見る',
      searching: '検索中...',
      errorOccurred: 'エラーが発生しました',
    },
    en: {
      resultCount: (count: number) => `${count} results`,
      noResults: 'No results found',
      tryDifferent: 'Try searching with different keywords',
      score: 'Relevance',
      semanticScore: 'AI Similarity',
      keywordScore: 'Keyword Match',
      price: 'Price',
      yen: 'JPY~',
      releaseDate: 'Release Date',
      performers: 'Performers',
      viewDetails: 'View Details',
      searching: 'Searching...',
      errorOccurred: 'An error occurred',
    },
  };
  const texts = t[locale as keyof typeof t] || t.ja;

  // 初期クエリがある場合は自動検索
  useEffect(() => {
    if (initialQuery && isConfigured) {
      performSearch(initialQuery);
    }
  }, [initialQuery, isConfigured]);

  const performSearch = async (searchQuery: string) => {
    if (!searchQuery.trim() || !isConfigured) return;

    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const params = new URLSearchParams({
        q: searchQuery,
        limit: '24',
        hybrid: hybridMode ? 'true' : 'false',
      });

      const response = await fetch(`/api/products/search/semantic?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Search failed');
      }

      setResults(data.results || []);
      setSearchMode(data.mode);
    } catch (err) {
      setError(err instanceof Error ? err.message : texts.errorOccurred);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      // URLを更新
      router.push(localizedHref(`/search/semantic?q=${encodeURIComponent(query)}`, locale));
      performSearch(query);
    }
  };

  return (
    <div>
      {/* 検索フォーム */}
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={translations.placeholder}
              disabled={!isConfigured}
              className="w-full px-4 py-3 pl-12 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
            />
            <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-400" />
          </div>
          <button
            type="submit"
            disabled={!query.trim() || loading || !isConfigured}
            className="px-6 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Search className="w-5 h-5" />
            )}
            {translations.searchButton}
          </button>
        </div>

        {/* ハイブリッドモードトグル */}
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setHybridMode(!hybridMode)}
            className="flex items-center gap-2 text-sm"
            disabled={!isConfigured}
          >
            {hybridMode ? (
              <ToggleRight className="w-6 h-6 text-purple-400" />
            ) : (
              <ToggleLeft className="w-6 h-6 text-gray-500" />
            )}
            <span className={hybridMode ? 'text-purple-300' : 'text-gray-500'}>
              {translations.hybridMode}
            </span>
          </button>
          <span className="text-xs text-gray-500">
            {translations.hybridModeDesc}
          </span>
        </div>
      </form>

      {/* エラー表示 */}
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300">
          {error}
        </div>
      )}

      {/* ローディング */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-purple-400 mx-auto mb-2" />
            <p className="theme-text-muted">{texts.searching}</p>
          </div>
        </div>
      )}

      {/* 検索結果 */}
      {!loading && hasSearched && (
        <div>
          {results.length === 0 ? (
            <div className="text-center py-12">
              <p className="theme-text-muted">{texts.noResults}</p>
              <p className="text-sm text-gray-500 mt-1">{texts.tryDifferent}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm theme-text-muted">
                {texts.resultCount(results.length)}
                {searchMode === 'hybrid' && (
                  <span className="ml-2 px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-xs">
                    Hybrid
                  </span>
                )}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {results.map((result) => (
                  <Link
                    key={result.id}
                    href={localizedHref(`/products/${result.normalizedProductId}`, locale)}
                    className="block rounded-lg overflow-hidden theme-card hover:ring-2 hover:ring-purple-500/50 transition-all"
                  >
                    {/* サムネイル */}
                    <div className="aspect-video bg-gray-800 relative">
                      {result.thumbnailUrl ? (
                        <img
                          src={result.thumbnailUrl}
                          alt={result.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-600">
                          No Image
                        </div>
                      )}
                      {/* スコアバッジ */}
                      <div className="absolute top-2 right-2 px-2 py-1 rounded bg-black/70 text-xs">
                        <span className="text-purple-400 font-medium">
                          {(result.score * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {/* 情報 */}
                    <div className="p-3">
                      <h3 className="font-medium text-sm theme-text line-clamp-2 mb-2">
                        {result.title}
                      </h3>

                      {/* 出演者 */}
                      {result.performers && result.performers.length > 0 && (
                        <p className="text-xs theme-text-muted mb-2">
                          {result.performers.map((p) => p.name).join(', ')}
                        </p>
                      )}

                      <div className="flex items-center justify-between text-xs">
                        {/* 価格 */}
                        {result.minPrice && (
                          <span className="text-pink-400 font-medium">
                            ¥{result.minPrice.toLocaleString()}〜
                          </span>
                        )}

                        {/* 発売日 */}
                        {result.releaseDate && (
                          <span className="theme-text-muted">
                            {result.releaseDate}
                          </span>
                        )}
                      </div>

                      {/* ハイブリッドモードの詳細スコア */}
                      {searchMode === 'hybrid' && (result.semanticScore !== undefined || result.keywordScore !== undefined) && (
                        <div className="mt-2 pt-2 border-t border-gray-700/50 flex gap-2 text-xs">
                          {result.semanticScore !== undefined && (
                            <span className="text-purple-400">
                              AI: {(result.semanticScore * 100).toFixed(0)}%
                            </span>
                          )}
                          {result.keywordScore !== undefined && result.keywordScore > 0 && (
                            <span className="text-green-400">
                              KW: {(result.keywordScore * 100).toFixed(0)}%
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
