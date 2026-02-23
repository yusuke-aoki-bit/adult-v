'use client';

import { useState, useCallback, useEffect, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePerformerCompareList } from '@adult-v/shared/hooks';
import { PerformerCompare } from '@adult-v/shared/components';

const translations = {
  title: { ja: '女優を比較', en: 'Compare Performers' },
  subtitle: { ja: '最大4名まで比較できます', en: 'Compare up to 4 performers' },
  addPerformer: { ja: '女優を追加', en: 'Add Performer' },
  searchPlaceholder: { ja: '女優名で検索...', en: 'Search by name...' },
  search: { ja: '検索', en: 'Search' },
  selected: { ja: '選択中:', en: 'Selected:' },
  clearAll: { ja: 'すべてクリア', en: 'Clear All' },
  howToUse: { ja: '使い方', en: 'How to use' },
  step1: { ja: '1. 上の検索ボックスで比較したい女優を検索', en: '1. Search for performers you want to compare' },
  step2: { ja: '2. 検索結果から女優をクリックして追加（最大4名）', en: '2. Click on search results to add (up to 4)' },
  step3: { ja: '3. 出演本数、トレンド、ファン度などを比較', en: '3. Compare releases, trends, fan scores, etc.' },
} as const;

type TranslationKey = keyof typeof translations;

function PerformerComparePageClient({ locale }: { locale: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { clearAll, removeItem } = usePerformerCompareList();

  const t = (key: TranslationKey) => translations[key][locale === 'ja' ? 'ja' : 'en'];

  // URLパラメータから初期値を取得
  const [performerIds, setPerformerIds] = useState<string[]>(() => {
    const idsParam = searchParams.get('ids');
    return idsParam ? idsParam.split(',').slice(0, 4) : [];
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<
    Array<{
      id: string;
      name: string;
      imageUrl: string | null;
    }>
  >([]);
  const [isSearching, setIsSearching] = useState(false);

  // URLを更新
  useEffect(() => {
    if (performerIds.length > 0) {
      const newUrl = `/${locale}/compare/performers?ids=${performerIds.join(',')}`;
      window.history.replaceState({}, '', newUrl);
    }
  }, [performerIds, locale]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const response = await fetch(`/api/actresses?query=${encodeURIComponent(searchQuery)}&limit=10`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(
          data.actresses?.map((p: { id: string; name: string; imageUrl?: string | null }) => ({
            id: p.id,
            name: p.name,
            imageUrl: p.imageUrl || null,
          })) || [],
        );
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery]);

  const handleAddPerformer = useCallback(
    (performerId: string) => {
      if (performerIds.length >= 4) return;
      if (performerIds.includes(performerId)) return;
      setPerformerIds((prev) => [...prev, performerId]);
      setSearchQuery('');
      setSearchResults([]);
    },
    [performerIds],
  );

  const handleRemovePerformer = useCallback(
    (performerId: string) => {
      setPerformerIds((prev) => prev.filter((id) => id !== performerId));
      removeItem(performerId);
    },
    [removeItem],
  );

  const handleClearAll = useCallback(() => {
    setPerformerIds([]);
    clearAll();
  }, [clearAll]);

  const handlePerformerClick = useCallback(
    (performerId: string) => {
      router.push(`/${locale}/actress/${performerId}`);
    },
    [router, locale],
  );

  return (
    <div className="theme-body min-h-screen">
      <main className="theme-bg min-h-screen">
        <div className="container mx-auto px-4 py-8">
          <div className="mx-auto max-w-6xl">
            {/* ヘッダー */}
            <div className="mb-6">
              <h1 className="theme-text mb-2 text-2xl font-bold sm:text-3xl">{t('title')}</h1>
              <p className="theme-text-secondary">{t('subtitle')}</p>
            </div>

            {/* 女優追加セクション */}
            {performerIds.length < 4 && (
              <div className="mb-6 rounded-2xl border border-gray-700 bg-gray-800/50 p-4">
                <h2 className="theme-text mb-3 flex items-center gap-2 font-semibold">
                  <svg className="h-5 w-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  {t('addPerformer')}
                </h2>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder={t('searchPlaceholder')}
                    className="flex-1 rounded-xl border border-gray-600 bg-gray-700 px-4 py-3 text-white placeholder-gray-400 transition-all focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 focus:outline-none"
                  />
                  <button
                    onClick={handleSearch}
                    disabled={isSearching}
                    className="rounded-xl bg-purple-600 px-6 py-3 font-medium text-white transition-all hover:bg-purple-700 disabled:opacity-50"
                  >
                    {isSearching ? (
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    ) : (
                      t('search')
                    )}
                  </button>
                </div>

                {/* 検索結果 */}
                {searchResults.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                    {searchResults.map((result) => (
                      <button
                        key={result.id}
                        onClick={() => handleAddPerformer(result.id)}
                        disabled={performerIds.includes(result.id)}
                        className={`rounded-xl border p-3 transition-all ${
                          performerIds.includes(result.id)
                            ? 'cursor-not-allowed border-gray-600 opacity-50'
                            : 'border-gray-600 hover:scale-105 hover:border-purple-500 hover:bg-gray-700/50'
                        }`}
                      >
                        {result.imageUrl ? (
                          <img
                            src={result.imageUrl}
                            alt={result.name}
                            className="mb-2 aspect-square w-full rounded-full object-cover"
                          />
                        ) : (
                          <div className="mb-2 flex aspect-square w-full items-center justify-center rounded-full bg-gray-600">
                            <svg
                              className="h-8 w-8 text-gray-400"
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
                          </div>
                        )}
                        <p className="line-clamp-1 text-center text-sm font-medium text-white">{result.name}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 選択中の女優数 */}
            <div className="mb-6 flex items-center gap-3">
              <span className="theme-text-secondary text-sm">{t('selected')}</span>
              <span className="rounded-full bg-purple-600 px-3 py-1.5 text-sm font-medium text-white">
                {performerIds.length} / 4
              </span>
              {performerIds.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="flex items-center gap-1 text-sm text-red-400 transition-colors hover:text-red-300"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  {t('clearAll')}
                </button>
              )}
            </div>

            {/* 比較コンポーネント */}
            <PerformerCompare
              performerIds={performerIds}
              locale={locale}
              theme="dark"
              onPerformerClick={handlePerformerClick}
              onRemovePerformer={handleRemovePerformer}
            />

            {/* 使い方 */}
            <div className="mt-8 rounded-2xl border border-gray-700 bg-gray-800/50 p-5">
              <h2 className="theme-text mb-3 flex items-center gap-2 font-semibold">
                <svg className="h-5 w-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {t('howToUse')}
              </h2>
              <ul className="theme-text-secondary space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-600/20 text-xs text-purple-400">
                    1
                  </span>
                  {t('step1')}
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-600/20 text-xs text-purple-400">
                    2
                  </span>
                  {t('step2')}
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-600/20 text-xs text-purple-400">
                    3
                  </span>
                  {t('step3')}
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function PerformerComparePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);

  return <PerformerComparePageClient locale={locale} />;
}
