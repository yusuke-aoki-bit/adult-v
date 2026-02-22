'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { TrendingUp, Sparkles, Clock, ChevronDown, ChevronUp, RefreshCw, AlertCircle } from 'lucide-react';
import { getThemeConfig, type SectionTheme } from './theme';
import { weeklyHighlightsTranslations, getTranslation } from './translations';
import { useSiteTheme } from '../../contexts/SiteThemeContext';
import { ActressCardBase } from '../ActressCard';
import { ProductCardBase } from '../ProductCard';

interface TrendingActress {
  id: number;
  name: string;
  thumbnailUrl: string | null;
  heroImageUrl: string | null;
  productCount: number;
  viewsThisWeek: number;
  growthRate: number;
}

interface HotNewRelease {
  id: number;
  title: string;
  imageUrl: string | null;
  releaseDate: string | null;
  rating: number | null;
  viewCount: number;
}

interface RediscoveredClassic {
  id: number;
  title: string;
  imageUrl: string | null;
  releaseDate: string | null;
  recentViews: number;
  daysSinceRelease: number;
}

interface WeeklyHighlightsData {
  trendingActresses: TrendingActress[];
  hotNewReleases: HotNewRelease[];
  rediscoveredClassics: RediscoveredClassic[];
}

interface WeeklyHighlightsSectionProps {
  /** Locale for translations */
  locale: string;
  /** Theme for styling: 'dark' for apps/web, 'light' for apps/fanza */
  theme?: SectionTheme;
  /** Custom fetch function for highlights data */
  fetchHighlights?: () => Promise<WeeklyHighlightsData>;
}

/**
 * Shared WeeklyHighlights section component
 * Displays trending actresses, hot new releases, and rediscovered classics
 */
export function WeeklyHighlightsSection({
  locale,
  theme: themeProp,
  fetchHighlights,
}: WeeklyHighlightsSectionProps): ReactNode {
  const { theme: contextTheme } = useSiteTheme();
  const theme = (themeProp ?? contextTheme) as SectionTheme;
  const [data, setData] = useState<WeeklyHighlightsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const t = getTranslation(weeklyHighlightsTranslations, locale);
  const themeConfig = getThemeConfig(theme);
  const styles = themeConfig.weeklyHighlights;

  // リトライハンドラー
  const handleRetry = useCallback(() => {
    setIsRetrying(true);
    setError(null);
    setHasFetched(false);
    setRetryCount(prev => prev + 1);
  }, []);

  // 遅延フェッチ: 展開されたときのみデータを取得（パフォーマンス優先）
  useEffect(() => {
    if (!isExpanded || hasFetched) return;

    async function doFetch() {
      setIsLoading(true);
      setError(null);

      try {
        let highlights: WeeklyHighlightsData;
        if (fetchHighlights) {
          highlights = await fetchHighlights();
        } else {
          const response = await fetch('/api/weekly-highlights');
          if (response.ok) {
            highlights = await response.json();
          } else {
            throw new Error('Failed to fetch weekly highlights');
          }
        }
        setData(highlights);
        setHasFetched(true);
      } catch (err) {
        console.error('Failed to fetch weekly highlights:', err);
        setError(t.fetchError);
      } finally {
        setIsLoading(false);
        setIsRetrying(false);
      }
    }

    doFetch();
  }, [isExpanded, hasFetched, fetchHighlights, retryCount, locale]);

  const hasData = data && (
    data.trendingActresses.length > 0 ||
    data.hotNewReleases.length > 0 ||
    data.rediscoveredClassics.length > 0
  );

  // 初期状態（閉じている & 未フェッチ）では常に表示
  // フェッチ後にデータがなければ非表示（ただしエラー時はリトライUIを表示）
  if (hasFetched && !hasData && !isLoading && !error) {
    return null;
  }

  // Convert theme for card components
  const cardTheme = theme === 'dark' ? 'dark' : 'light';

  // Toggle handler memoized with useCallback
  const handleToggle = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      setIsExpanded(prev => !prev);
    }
  }, []);

  return (
    <section className="py-3 sm:py-4">
      <div className="container mx-auto px-3 sm:px-4">
        <div className={styles.containerClass}>
          {/* Header - div with role="button" to avoid nested button issues */}
          <div
            role="button"
            tabIndex={0}
            onClick={handleToggle}
            onKeyDown={handleKeyDown}
            className="w-full flex items-center justify-between mb-4 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 ${styles.iconBgClass} rounded-lg`}>
                <TrendingUp className={`h-5 w-5 ${styles.iconColorClass}`} />
              </div>
              <div className="text-left">
                <h2 className={`text-lg font-bold ${styles.titleClass}`}>{t.title}</h2>
                <p className={`text-sm ${styles.subtitleClass}`}>{t.subtitle}</p>
              </div>
            </div>
            {isExpanded ? (
              <ChevronUp className={`h-5 w-5 ${styles.chevronClass}`} />
            ) : (
              <ChevronDown className={`h-5 w-5 ${styles.chevronClass}`} />
            )}
          </div>

          {isExpanded && (
            <>
              {/* エラー時はリトライボタンを表示 */}
              {error ? (
                <div className={`flex flex-col items-center justify-center py-8 px-4 rounded-lg ${
                  theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-100'
                }`}>
                  <AlertCircle className={`w-8 h-8 mb-3 ${
                    theme === 'dark' ? 'text-red-400' : 'text-red-500'
                  }`} />
                  <p className={`text-sm mb-4 text-center ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                    {error}
                  </p>
                  <button
                    onClick={handleRetry}
                    disabled={isRetrying}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      theme === 'dark'
                        ? 'bg-rose-600 hover:bg-rose-700 text-white disabled:bg-gray-600'
                        : 'bg-rose-500 hover:bg-rose-600 text-white disabled:bg-gray-400'
                    } disabled:cursor-not-allowed`}
                  >
                    <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
                    {isRetrying ? t.retrying : t.retry}
                  </button>
                </div>
              ) : (isLoading || !hasData) ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="space-y-3">
                      <div className={`h-6 w-32 ${styles.skeletonBgClass} rounded animate-pulse`} />
                      <div className="grid grid-cols-3 gap-2">
                        {[1, 2, 3].map((j) => (
                          <div key={j} className={`${styles.cardBgClass} rounded-lg overflow-hidden animate-pulse`}>
                            <div className={styles.skeletonBgClass} style={{ aspectRatio: '2/3' }} />
                            <div className="p-1.5 space-y-1">
                              <div className={`h-2.5 ${styles.skeletonBgClass} rounded w-3/4`} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Trending Actresses */}
                  {data?.trendingActresses && data.trendingActresses.length > 0 && (
                    <div>
                      <h3 className={`text-sm font-semibold ${styles.trendingTitleClass} mb-3 flex items-center gap-2`}>
                        <TrendingUp className="h-4 w-4" />
                        {t.trendingActresses}
                      </h3>
                      <div className="grid grid-cols-3 gap-2">
                        {data.trendingActresses.slice(0, 3).map((actress) => (
                          <ActressCardBase
                            key={actress['id']}
                            actress={{
                              id: String(actress['id']),
                              name: actress['name'],
                              ...(actress['thumbnailUrl'] && { thumbnail: actress['thumbnailUrl'] }),
                              ...(actress.heroImageUrl && { heroImage: actress.heroImageUrl }),
                              metrics: {
                                releaseCount: actress.productCount,
                                trendingScore: actress.growthRate,
                                fanScore: 0,
                              },
                            }}
                            size="mini"
                            theme={cardTheme}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Hot New Releases */}
                  {data?.hotNewReleases && data.hotNewReleases.length > 0 && (
                    <div>
                      <h3 className={`text-sm font-semibold ${styles.hotTitleClass} mb-3 flex items-center gap-2`}>
                        <Sparkles className="h-4 w-4" />
                        {t.hotNewReleases}
                      </h3>
                      <div className="grid grid-cols-3 gap-2">
                        {data.hotNewReleases.slice(0, 3).map((product) => (
                          <ProductCardBase
                            key={product['id']}
                            product={{
                              id: String(product['id']),
                              title: product['title'],
                              ...(product.imageUrl && { imageUrl: product.imageUrl }),
                              ...(product['releaseDate'] && { releaseDate: product['releaseDate'] }),
                              ...(product['rating'] !== undefined && product['rating'] !== null && { rating: product['rating'] }),
                              price: 0,
                            }}
                            size="mini"
                            theme={cardTheme}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Rediscovered Classics */}
                  {data?.rediscoveredClassics && data.rediscoveredClassics.length > 0 && (
                    <div>
                      <h3 className={`text-sm font-semibold ${styles.classicTitleClass} mb-3 flex items-center gap-2`}>
                        <Clock className="h-4 w-4" />
                        {t.rediscoveredClassics}
                      </h3>
                      <div className="grid grid-cols-3 gap-2">
                        {data.rediscoveredClassics.slice(0, 3).map((product) => (
                          <div key={product['id']} className="relative">
                            <ProductCardBase
                              product={{
                                id: String(product['id']),
                                title: product['title'],
                                ...(product.imageUrl && { imageUrl: product.imageUrl }),
                                ...(product['releaseDate'] && { releaseDate: product['releaseDate'] }),
                                price: 0,
                              }}
                              size="mini"
                              theme={cardTheme}
                            />
                            {/* Years ago badge overlay */}
                            <div className="absolute top-1 left-1 bg-rose-600 text-white text-[10px] font-bold px-1 py-0.5 rounded z-10">
                              {Math.floor(product.daysSinceRelease / 365)}{t.yearsAgo}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
