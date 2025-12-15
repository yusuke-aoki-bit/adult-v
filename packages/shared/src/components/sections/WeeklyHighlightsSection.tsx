'use client';

import { useState, useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { TrendingUp, Sparkles, Clock, User, Film, ChevronDown, ChevronUp, Star } from 'lucide-react';
import { getThemeConfig, type SectionTheme } from './theme';
import { weeklyHighlightsTranslations, getTranslation } from './translations';

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
  const [isExpanded, setIsExpanded] = useState(true);

  const t = getTranslation(weeklyHighlightsTranslations, locale);
  const themeConfig = getThemeConfig(theme);
  const styles = themeConfig.weeklyHighlights;

  useEffect(() => {
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
      } catch (error) {
        console.error('Failed to fetch weekly highlights:', error);
      } finally {
        setIsLoading(false);
      }
    }

    doFetch();
  }, [fetchHighlights]);

  const hasData = data && (
    data.trendingActresses.length > 0 ||
    data.hotNewReleases.length > 0 ||
    data.rediscoveredClassics.length > 0
  );

  if (!hasData && !isLoading) {
    return null;
  }

  // Determine placeholder icon color based on theme
  const placeholderIconClass = theme === 'dark' ? 'text-gray-600' : 'text-gray-400';
  const placeholderBgClass = theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100';

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
                          <Link
                            key={actress.id}
                            href={`/${locale}/actress/${actress.id}`}
                            className={`group ${styles.cardBgClass} rounded-lg overflow-hidden hover:ring-2 hover:ring-amber-500/50 transition-all`}
                          >
                            <div className={`aspect-square relative ${placeholderBgClass}`}>
                              {actress.heroImageUrl || actress.thumbnailUrl ? (
                                <Image
                                  src={actress.heroImageUrl || actress.thumbnailUrl || ''}
                                  alt={actress.name}
                                  fill
                                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                              ) : (
                                <div className="flex items-center justify-center h-full">
                                  <User className={`h-8 w-8 ${placeholderIconClass}`} />
                                </div>
                              )}
                              {actress.growthRate > 0 && (
                                <div className="absolute top-1 right-1 bg-green-600 text-white text-[10px] font-bold px-1 py-0.5 rounded flex items-center gap-0.5">
                                  <TrendingUp className="h-2.5 w-2.5" />
                                  {actress.growthRate}%
                                </div>
                              )}
                            </div>
                            <div className="p-1.5">
                              <p className={`${styles.cardTextClass} text-xs font-medium truncate ${styles.cardHoverTextClass} transition-colors`}>
                                {actress.name}
                              </p>
                            </div>
                          </Link>
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
                          <Link
                            key={product.id}
                            href={`/${locale}/products/${product.id}`}
                            className={`group ${styles.cardBgClass} rounded-lg overflow-hidden hover:ring-2 hover:ring-orange-500/50 transition-all`}
                          >
                            <div className={`aspect-[2/3] relative ${placeholderBgClass}`}>
                              {product.imageUrl ? (
                                <Image
                                  src={product.imageUrl}
                                  alt={product.title}
                                  fill
                                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                              ) : (
                                <div className="flex items-center justify-center h-full">
                                  <Film className={`h-8 w-8 ${placeholderIconClass}`} />
                                </div>
                              )}
                              {product.rating && product.rating > 0 && (
                                <div className="absolute top-1 right-1 bg-yellow-500 text-black text-[10px] font-bold px-1 py-0.5 rounded flex items-center gap-0.5">
                                  <Star className="h-2.5 w-2.5 fill-current" />
                                  {product.rating.toFixed(1)}
                                </div>
                              )}
                            </div>
                            <div className="p-1.5">
                              <p className={`${styles.cardTextClass} text-xs font-medium line-clamp-2 group-hover:text-orange-${theme === 'dark' ? '300' : '600'} transition-colors`}>
                                {product.title}
                              </p>
                            </div>
                          </Link>
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
                          <Link
                            key={product.id}
                            href={`/${locale}/products/${product.id}`}
                            className={`group ${styles.cardBgClass} rounded-lg overflow-hidden hover:ring-2 hover:ring-rose-500/50 transition-all`}
                          >
                            <div className={`aspect-[2/3] relative ${placeholderBgClass}`}>
                              {product.imageUrl ? (
                                <Image
                                  src={product.imageUrl}
                                  alt={product.title}
                                  fill
                                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                              ) : (
                                <div className="flex items-center justify-center h-full">
                                  <Film className={`h-8 w-8 ${placeholderIconClass}`} />
                                </div>
                              )}
                              <div className="absolute top-1 right-1 bg-rose-600 text-white text-[10px] font-bold px-1 py-0.5 rounded">
                                {Math.floor(product.daysSinceRelease / 365)}{t.yearsAgo}
                              </div>
                            </div>
                            <div className="p-1.5">
                              <p className={`${styles.cardTextClass} text-xs font-medium line-clamp-2 group-hover:text-rose-${theme === 'dark' ? '300' : '600'} transition-colors`}>
                                {product.title}
                              </p>
                            </div>
                          </Link>
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
