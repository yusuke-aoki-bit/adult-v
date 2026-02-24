'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, Loader2, Sparkles, ToggleLeft, ToggleRight } from 'lucide-react';
import { localizedHref } from '../i18n';
import { getTranslation, semanticSearchClientTranslations } from '../lib/translations';

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

  const texts = getTranslation(semanticSearchClientTranslations, locale);

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
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 pl-12 text-white placeholder-gray-400 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none disabled:opacity-50"
            />
            <Sparkles className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-purple-400" />
          </div>
          <button
            type="submit"
            disabled={!query.trim() || loading || !isConfigured}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-fuchsia-600 px-6 py-3 font-medium text-white transition-all hover:from-purple-500 hover:to-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
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
              <ToggleRight className="h-6 w-6 text-purple-400" />
            ) : (
              <ToggleLeft className="h-6 w-6 text-gray-500" />
            )}
            <span className={hybridMode ? 'text-purple-300' : 'text-gray-500'}>{translations.hybridMode}</span>
          </button>
          <span className="text-xs text-gray-500">{translations.hybridModeDesc}</span>
        </div>
      </form>

      {/* エラー表示 */}
      {error && <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-300">{error}</div>}

      {/* ローディング */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin text-purple-400" />
            <p className="theme-text-muted">{texts.searching}</p>
          </div>
        </div>
      )}

      {/* 検索結果 */}
      {!loading && hasSearched && (
        <div>
          {results.length === 0 ? (
            <div className="py-12 text-center">
              <p className="theme-text-muted">{texts.noResults}</p>
              <p className="mt-1 text-sm text-gray-500">{texts.tryDifferent}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="theme-text-muted text-sm">
                {texts.resultCount(results.length)}
                {searchMode === 'hybrid' && (
                  <span className="ml-2 rounded bg-purple-500/20 px-2 py-0.5 text-xs text-purple-300">Hybrid</span>
                )}
              </p>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {results.map((result) => (
                  <Link
                    key={result.id}
                    href={localizedHref(`/products/${result.normalizedProductId}`, locale)}
                    className="theme-card block overflow-hidden rounded-lg transition-all hover:ring-2 hover:ring-purple-500/50"
                  >
                    {/* サムネイル */}
                    <div className="relative aspect-video bg-gray-800">
                      {result.thumbnailUrl ? (
                        <img
                          src={result.thumbnailUrl}
                          alt={result.title}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-gray-600">No Image</div>
                      )}
                      {/* スコアバッジ */}
                      <div className="absolute top-2 right-2 rounded bg-black/70 px-2 py-1 text-xs">
                        <span className="font-medium text-purple-400">{(result.score * 100).toFixed(1)}%</span>
                      </div>
                    </div>

                    {/* 情報 */}
                    <div className="p-3">
                      <h3 className="theme-text mb-2 line-clamp-2 text-sm font-medium">{result.title}</h3>

                      {/* 出演者 */}
                      {result.performers && result.performers.length > 0 && (
                        <p className="theme-text-muted mb-2 text-xs">
                          {result.performers.map((p) => p.name).join(', ')}
                        </p>
                      )}

                      <div className="flex items-center justify-between text-xs">
                        {/* 価格 */}
                        {result.minPrice && (
                          <span className="font-medium text-fuchsia-400">¥{result.minPrice.toLocaleString()}〜</span>
                        )}

                        {/* 発売日 */}
                        {result.releaseDate && <span className="theme-text-muted">{result.releaseDate}</span>}
                      </div>

                      {/* ハイブリッドモードの詳細スコア */}
                      {searchMode === 'hybrid' &&
                        (result.semanticScore !== undefined || result.keywordScore !== undefined) && (
                          <div className="mt-2 flex gap-2 border-t border-gray-700/50 pt-2 text-xs">
                            {result.semanticScore !== undefined && (
                              <span className="text-purple-400">AI: {(result.semanticScore * 100).toFixed(0)}%</span>
                            )}
                            {result.keywordScore !== undefined && result.keywordScore > 0 && (
                              <span className="text-green-400">KW: {(result.keywordScore * 100).toFixed(0)}%</span>
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
