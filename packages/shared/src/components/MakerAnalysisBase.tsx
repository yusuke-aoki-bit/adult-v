'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Building2, Tag, Star, ChevronRight, ChevronDown } from 'lucide-react';
import { useRecentlyViewed } from '../hooks/useRecentlyViewed';
import { localizedHref } from '../i18n';
import { useSiteTheme, type SiteTheme } from '../contexts/SiteThemeContext';
import { getTranslation, makerAnalysisTranslations } from '../lib/translations';

const themeClasses = {
  dark: {
    container: 'bg-gray-800',
    skeleton: 'bg-gray-700',
    textPrimary: 'text-white',
    textMuted: 'text-gray-400',
    textSubtle: 'text-gray-500',
    accentBlue: 'text-blue-400',
    surface: 'bg-gray-750 hover:bg-gray-700',
    badgeFirst: 'bg-yellow-500 text-black',
    badgeSecond: 'bg-gray-400 text-black',
    badgeThird: 'bg-amber-600 text-white',
    badgeDefault: 'bg-gray-700 text-gray-300',
    nameHover: 'text-white group-hover:text-blue-400',
    categoryMaker: 'bg-blue-900/50 text-blue-300',
    categoryLabel: 'bg-purple-900/50 text-purple-300',
    percentage: 'text-blue-400',
    rating: 'text-yellow-400',
    chevron: 'text-gray-500 group-hover:text-blue-400',
    expandBtn: 'text-gray-400 hover:text-white',
    border: 'border-gray-700',
    tagMaker: 'bg-blue-900/30 text-blue-300 hover:bg-blue-900/50',
    tagLabel: 'bg-purple-900/30 text-purple-300 hover:bg-purple-900/50',
  },
  light: {
    container: 'bg-white shadow',
    skeleton: 'bg-gray-200',
    textPrimary: 'text-gray-900',
    textMuted: 'text-gray-500',
    textSubtle: 'text-gray-400',
    accentBlue: 'text-blue-500',
    surface: 'bg-gray-50 hover:bg-gray-100',
    badgeFirst: 'bg-yellow-400 text-yellow-900',
    badgeSecond: 'bg-gray-300 text-gray-700',
    badgeThird: 'bg-amber-500 text-white',
    badgeDefault: 'bg-gray-200 text-gray-600',
    nameHover: 'text-gray-900 group-hover:text-blue-600',
    categoryMaker: 'bg-blue-100 text-blue-700',
    categoryLabel: 'bg-purple-100 text-purple-700',
    percentage: 'text-blue-600',
    rating: 'text-yellow-600',
    chevron: 'text-gray-400 group-hover:text-blue-500',
    expandBtn: 'text-gray-500 hover:text-gray-700',
    border: 'border-gray-200',
    tagMaker: 'bg-blue-50 text-blue-700 hover:bg-blue-100',
    tagLabel: 'bg-purple-50 text-purple-700 hover:bg-purple-100',
  },
} as const;

function getTheme(theme: SiteTheme) {
  return themeClasses[theme];
}

interface MakerPreference {
  makerId: number;
  makerName: string;
  category: string;
  count: number;
  averageRating: number | null;
}

interface MakerAnalysisBaseProps {
  locale: string;
  className?: string;
}

export default function MakerAnalysisBase({ locale, className = '' }: MakerAnalysisBaseProps) {
  const { theme } = useSiteTheme();
  const tc = getTheme(theme);
  const t = getTranslation(makerAnalysisTranslations, locale);
  const { items: viewedItems, isLoading: isViewLoading } = useRecentlyViewed();
  const [makers, setMakers] = useState<MakerPreference[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    async function fetchMakerAnalysis() {
      if (viewedItems.length === 0) return;

      setIsLoading(true);
      try {
        const productIds = viewedItems.map((item) => parseInt(item.id, 10)).filter((id) => !isNaN(id));

        if (productIds.length === 0) return;

        const res = await fetch('/api/makers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productIds, locale }),
        });
        if (!res.ok) return;
        const data = await res.json();
        setMakers(data.makers || []);
      } catch {
        // API failure is non-critical - silently show empty state
      } finally {
        setIsLoading(false);
      }
    }

    if (!isViewLoading) {
      fetchMakerAnalysis();
    }
  }, [viewedItems, isViewLoading, locale]);

  if (isViewLoading || isLoading) {
    return (
      <div className={`${tc.container} rounded-lg p-6 ${className}`}>
        <div className="animate-pulse">
          <div className={`h-6 w-40 ${tc.skeleton} mb-4 rounded`} />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`h-12 ${tc.skeleton} rounded`} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (makers.length === 0) {
    return (
      <div className={`${tc.container} rounded-lg p-6 ${className}`}>
        <h3 className={`text-lg font-bold ${tc.textPrimary} mb-2 flex items-center gap-2`}>
          <Building2 className={`h-5 w-5 ${tc.accentBlue}`} />
          {t.title}
        </h3>
        <p className={`text-sm ${tc.textMuted}`}>{t.noDataDesc}</p>
      </div>
    );
  }

  const topMakers = makers.filter((m) => m.category === 'maker');
  const topLabels = makers.filter((m) => m.category === 'label');
  const totalViews = makers.reduce((sum, m) => sum + m.count, 0);
  const displayedMakers = isExpanded ? makers : makers.slice(0, 5);

  return (
    <div className={`${tc.container} rounded-lg p-6 ${className}`}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className={`text-lg font-bold ${tc.textPrimary} flex items-center gap-2`}>
            <Building2 className={`h-5 w-5 ${tc.accentBlue}`} />
            {t.title}
          </h3>
          <p className={`text-sm ${tc.textMuted}`}>{t.subtitle}</p>
        </div>
      </div>

      <div className="space-y-3">
        {displayedMakers.map((maker, index) => {
          const percentage = Math.round((maker.count / totalViews) * 100);
          return (
            <Link key={maker.makerId} href={localizedHref(`/makers/${maker.makerId}`, locale)} className="group block">
              <div className={`flex items-center gap-3 rounded-lg p-3 ${tc.surface} transition-colors`}>
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    index === 0
                      ? tc.badgeFirst
                      : index === 1
                        ? tc.badgeSecond
                        : index === 2
                          ? tc.badgeThird
                          : tc.badgeDefault
                  }`}
                >
                  {index + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className={`truncate font-medium ${tc.nameHover} transition-colors`}>{maker.makerName}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs ${
                        maker.category === 'maker' ? tc.categoryMaker : tc.categoryLabel
                      }`}
                    >
                      {maker.category === 'maker' ? (
                        <Building2 className="inline h-3 w-3" />
                      ) : (
                        <Tag className="inline h-3 w-3" />
                      )}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-sm">
                    <span className={tc.textMuted}>
                      {maker.count} {t.works}
                    </span>
                    <span className={tc.percentage}>{percentage}%</span>
                    {maker.averageRating && (
                      <span className={`${tc.rating} flex items-center gap-1`}>
                        <Star className="h-3 w-3" />
                        {maker.averageRating.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>

                <ChevronRight className={`h-5 w-5 ${tc.chevron} shrink-0 transition-colors`} />
              </div>
            </Link>
          );
        })}
      </div>

      {makers.length > 5 && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`mt-4 w-full py-2 text-sm ${tc.expandBtn} flex items-center justify-center gap-1 transition-colors`}
        >
          {isExpanded ? (
            <>
              <ChevronDown className="h-4 w-4 rotate-180" />
              Show Less
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" />
              {t.viewMore} ({makers.length - 5})
            </>
          )}
        </button>
      )}

      {(topMakers.length > 0 || topLabels.length > 0) && (
        <div className={`mt-6 border-t pt-4 ${tc.border}`}>
          <div className="grid grid-cols-2 gap-4">
            {topMakers.length > 0 && (
              <div>
                <h4 className={`text-sm ${tc.textMuted} mb-2 flex items-center gap-1`}>
                  <Building2 className="h-4 w-4" />
                  {t.topMakers}
                </h4>
                <div className="flex flex-wrap gap-1">
                  {topMakers.slice(0, 3).map((m) => (
                    <Link
                      key={m.makerId}
                      href={localizedHref(`/makers/${m.makerId}`, locale)}
                      className={`px-2 py-1 text-xs ${tc.tagMaker} rounded transition-colors`}
                    >
                      {m.makerName}
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {topLabels.length > 0 && (
              <div>
                <h4 className={`text-sm ${tc.textMuted} mb-2 flex items-center gap-1`}>
                  <Tag className="h-4 w-4" />
                  {t.topLabels}
                </h4>
                <div className="flex flex-wrap gap-1">
                  {topLabels.slice(0, 3).map((m) => (
                    <Link
                      key={m.makerId}
                      href={localizedHref(`/makers/${m.makerId}`, locale)}
                      className={`px-2 py-1 text-xs ${tc.tagLabel} rounded transition-colors`}
                    >
                      {m.makerName}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
