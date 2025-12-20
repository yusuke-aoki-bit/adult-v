'use client';

import { useState, useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { TrendingUp, Sparkles, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { getThemeConfig, type SectionTheme } from './theme';
import { weeklyHighlightsTranslations, getTranslation } from './translations';
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
  theme: SectionTheme;
  /** Custom fetch function for highlights data */
  fetchHighlights?: () => Promise<WeeklyHighlightsData>;
}

/**
 * Shared WeeklyHighlights section component
 * Displays trending actresses, hot new releases, and rediscovered classics
 */
export function WeeklyHighlightsSection({
  locale,
  theme,
  fetchHighlights,
}: WeeklyHighlightsSectionProps): ReactNode {
  const [data, setData] = useState<WeeklyHighlightsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  const t = getTranslation(weeklyHighlightsTranslations, locale);
  const themeConfig = getThemeConfig(theme);
  const styles = themeConfig.weeklyHighlights;

  // 遅延フェッチ: 展開されたときのみデータを取得（パフォーマンス優先）
  useEffect(() => {
    if (!isExpanded || hasFetched) return;

    async function doFetch() {
      try {
        let highlights: WeeklyHighlightsData;
        if (fetchHighlights) {
          highlights = await fetchHighlights();
        } else {
          const response = await fetch('/api/weekly-highlights');
          if (response.ok) {
            highlights = await response.json();
          } else {
            highlights = { trendingActresses: [], hotNewReleases: [], rediscoveredClassics: [] };
          }
        }
        setData(highlights);
        setHasFetched(true);
      } catch (error) {
        console.error('Failed to fetch weekly highlights:', error);
      } finally {
        setIsLoading(false);
      }
    }

    doFetch();
  }, [isExpanded, hasFetched, fetchHighlights]);

  const hasData = data && (
    data.trendingActresses.length > 0 ||
    data.hotNewReleases.length > 0 ||
    data.rediscoveredClassics.length > 0
  );

  // 初期状態（閉じている & 未フェッチ）では常に表示
  // フェッチ後にデータがなければ非表示
  if (hasFetched && !hasData && !isLoading) {
    return null;
  }

  // Convert theme for card components
  const cardTheme = theme === 'dark' ? 'dark' : 'light';

  return (
    <section className="py-3 sm:py-4">
      <div className="container mx-auto px-3 sm:px-4">
        <div className={styles.containerClass}>
          {/* Header */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center justify-between mb-4"
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
          </button>

          {isExpanded && (
            <>
              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="space-y-3">
                      <div className={`h-6 w-32 ${styles.skeletonBgClass} rounded animate-pulse`} />
                      <div className="grid grid-cols-3 gap-2">
                        {[1, 2, 3].map((j) => (
                          <div key={j} className={`${styles.cardBgClass} rounded-lg overflow-hidden animate-pulse`}>
                            <div className={`aspect-square ${styles.skeletonBgClass}`} />
                            <div className="p-2 space-y-1">
                              <div className={`h-3 ${styles.skeletonBgClass} rounded w-3/4`} />
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
                            key={actress.id}
                            actress={{
                              id: String(actress.id),
                              name: actress.name,
                              thumbnail: actress.thumbnailUrl ?? undefined,
                              heroImage: actress.heroImageUrl ?? undefined,
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
                            key={product.id}
                            product={{
                              id: String(product.id),
                              title: product.title,
                              imageUrl: product.imageUrl ?? undefined,
                              releaseDate: product.releaseDate ?? undefined,
                              rating: product.rating ?? undefined,
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
                          <div key={product.id} className="relative">
                            <ProductCardBase
                              product={{
                                id: String(product.id),
                                title: product.title,
                                imageUrl: product.imageUrl ?? undefined,
                                releaseDate: product.releaseDate ?? undefined,
                                price: 0,
                              }}
                              size="mini"
                              theme={cardTheme}
                            />
                            {/* Years ago badge overlay */}
                            <div className="absolute top-1 right-1 bg-rose-600 text-white text-[10px] font-bold px-1 py-0.5 rounded z-10">
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
