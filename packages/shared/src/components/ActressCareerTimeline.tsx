'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Calendar, TrendingUp, Star, Clock, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { useSiteTheme } from '../contexts/SiteThemeContext';
import { getTranslation, actressCareerTimelineTranslations } from '../lib/translations';

interface CareerProduct {
  id: number;
  title: string;
}

interface YearlyStat {
  year: number;
  count: number;
  products: CareerProduct[];
}

interface CareerAnalysis {
  totalProducts: number;
  debutYear: number | null;
  latestYear: number | null;
  averageProductsPerYear: number;
  peakYear: number | null;
  peakYearCount: number;
  yearlyStats: YearlyStat[];
  isActive: boolean;
  monthsSinceLastRelease: number | null;
  debutProduct: CareerProduct | null;
  latestProduct: CareerProduct | null;
}

interface ActressCareerTimelineProps {
  career: CareerAnalysis;
  actressName: string;
  locale: string;
  theme?: 'dark' | 'light';
}

const themes = {
  dark: {
    container: 'bg-gray-800 rounded-lg p-4 sm:p-6',
    title: 'text-white font-bold mb-4 flex items-center gap-2',
    titleIcon: 'w-5 h-5 text-blue-400',
    statCard: 'bg-gray-750 rounded-lg p-3 text-center',
    statValue: 'text-2xl font-bold text-white',
    statLabel: 'text-xs text-gray-400',
    avgValue: 'text-2xl font-bold text-emerald-400',
    peakValue: 'text-2xl font-bold text-yellow-400 flex items-center justify-center gap-1',
    activeValue: 'text-2xl font-bold text-green-400 flex items-center justify-center gap-1',
    inactiveValue: 'text-2xl font-bold text-orange-400 flex items-center justify-center gap-1',
    productCard: 'flex items-center gap-3 bg-gray-750 hover:bg-gray-700 rounded-lg p-3 transition-colors group',
    debutBadge: 'text-xs text-blue-400 font-medium',
    debutIcon: 'shrink-0 w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center',
    latestBadge: 'text-xs text-fuchsia-400 font-medium',
    latestIcon: 'shrink-0 w-10 h-10 rounded-full bg-fuchsia-600 flex items-center justify-center',
    productTitle: 'text-sm text-white truncate group-hover:text-fuchsia-300 transition-colors',
    toggleButton: 'flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-3 transition-colors',
    yearLabel: 'text-gray-400',
    yearLabelPeak: 'text-yellow-400',
    barBg: 'flex-1 h-6 bg-gray-700 rounded-full overflow-hidden',
    barNormal: 'bg-linear-to-r from-blue-500 to-purple-500',
    barPeak: 'bg-linear-to-r from-yellow-500 to-orange-500',
    countNormal: 'text-gray-300',
    countPeak: 'text-yellow-400 font-bold',
    productLink: 'text-xs text-gray-500 hover:text-fuchsia-400 truncate max-w-[150px]',
    productMore: 'text-xs text-gray-600',
  },
  light: {
    container: 'bg-white border border-gray-200 rounded-lg p-4 sm:p-6 shadow-sm',
    title: 'text-gray-800 font-bold mb-4 flex items-center gap-2',
    titleIcon: 'w-5 h-5 text-rose-600',
    statCard: 'bg-gray-50 rounded-lg p-3 text-center',
    statValue: 'text-2xl font-bold text-gray-800',
    statLabel: 'text-xs text-gray-500',
    avgValue: 'text-2xl font-bold text-emerald-600',
    peakValue: 'text-2xl font-bold text-amber-500 flex items-center justify-center gap-1',
    activeValue: 'text-2xl font-bold text-green-600 flex items-center justify-center gap-1',
    inactiveValue: 'text-2xl font-bold text-orange-500 flex items-center justify-center gap-1',
    productCard: 'flex items-center gap-3 bg-gray-50 hover:bg-gray-100 rounded-lg p-3 transition-colors group',
    debutBadge: 'text-xs text-blue-600 font-medium',
    debutIcon: 'shrink-0 w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center',
    latestBadge: 'text-xs text-rose-600 font-medium',
    latestIcon: 'shrink-0 w-10 h-10 rounded-full bg-rose-500 flex items-center justify-center',
    productTitle: 'text-sm text-gray-800 truncate group-hover:text-rose-500 transition-colors',
    toggleButton: 'flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-3 transition-colors',
    yearLabel: 'text-gray-500',
    yearLabelPeak: 'text-amber-600',
    barBg: 'flex-1 h-6 bg-gray-200 rounded-full overflow-hidden',
    barNormal: 'bg-linear-to-r from-blue-400 to-purple-400',
    barPeak: 'bg-linear-to-r from-amber-400 to-orange-400',
    countNormal: 'text-gray-600',
    countPeak: 'text-amber-600 font-bold',
    productLink: 'text-xs text-gray-500 hover:text-rose-500 truncate max-w-[150px]',
    productMore: 'text-xs text-gray-400',
  },
};

export function ActressCareerTimeline({
  career,
  actressName: _actressName,
  locale,
  theme: themeProp,
}: ActressCareerTimelineProps) {
  const { theme: contextTheme } = useSiteTheme();
  const theme = themeProp ?? contextTheme;
  const t = getTranslation(actressCareerTimelineTranslations, locale);
  const s = themes[theme];
  const [showTimeline, setShowTimeline] = useState(false);

  const maxCount = Math.max(...career.yearlyStats.map((y) => y.count));

  return (
    <div className={s.container}>
      <h3 className={s.title}>
        <Calendar className={s.titleIcon} />
        {t.title}
      </h3>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className={s.statCard}>
          <div className={s.statValue}>{career.totalProducts}</div>
          <div className={s.statLabel}>{t.totalProducts}</div>
        </div>

        <div className={s.statCard}>
          <div className={s.avgValue}>{career.averageProductsPerYear}</div>
          <div className={s.statLabel}>{t.avgPerYear}</div>
        </div>

        <div className={s.statCard}>
          <div className={s.peakValue}>
            <Star className="h-4 w-4" />
            {career.peakYear}
            {t.yearLabel}
          </div>
          <div className={s.statLabel}>
            {t.peakYear} ({career.peakYearCount}
            {t.products})
          </div>
        </div>

        <div className={s.statCard}>
          {career.isActive ? (
            <>
              <div className={s.activeValue}>
                <TrendingUp className="h-4 w-4" />
                {t.active}
              </div>
              <div className={s.statLabel}>
                {t.lastRelease}: {career.monthsSinceLastRelease}
                {t.monthsAgo}
              </div>
            </>
          ) : (
            <>
              <div className={s.inactiveValue}>
                <AlertTriangle className="h-4 w-4" />
                {t.inactive}
              </div>
              <div className={s.statLabel}>
                {career.monthsSinceLastRelease}
                {t.monthsAgo}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {career.debutProduct && (
          <Link href={`/${locale}/products/${career.debutProduct.id}`} className={s.productCard}>
            <div className={s.debutIcon}>
              <Star className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className={s.debutBadge}>
                {t.debut} ({career.debutYear}
                {t.yearLabel})
              </div>
              <div className={s.productTitle}>{career.debutProduct.title}</div>
            </div>
          </Link>
        )}

        {career.latestProduct && (
          <Link href={`/${locale}/products/${career.latestProduct.id}`} className={s.productCard}>
            <div className={s.latestIcon}>
              <Clock className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className={s.latestBadge}>{t.latest}</div>
              <div className={s.productTitle}>{career.latestProduct.title}</div>
            </div>
          </Link>
        )}
      </div>

      <button onClick={() => setShowTimeline(!showTimeline)} className={s.toggleButton}>
        {showTimeline ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        {showTimeline ? t.hideTimeline : t.showTimeline}
      </button>

      {showTimeline && (
        <div className="space-y-2">
          {career.yearlyStats.map((yearData) => {
            const barWidth = (yearData.count / maxCount) * 100;
            const isPeakYear = yearData.year === career.peakYear;

            return (
              <div key={yearData.year} className="group">
                <div className="flex items-center gap-3">
                  <div className={`w-12 text-sm font-medium ${isPeakYear ? s.yearLabelPeak : s.yearLabel}`}>
                    {yearData.year}
                  </div>

                  <div className={s.barBg}>
                    <div
                      className={`h-full rounded-full transition-all ${isPeakYear ? s.barPeak : s.barNormal}`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>

                  <div className={`w-8 text-right text-sm ${isPeakYear ? s.countPeak : s.countNormal}`}>
                    {yearData.count}
                  </div>
                </div>

                {isPeakYear && yearData.products.length > 0 && (
                  <div className="mt-1 ml-16 flex flex-wrap gap-1">
                    {yearData.products.slice(0, 3).map((product) => (
                      <Link key={product['id']} href={`/${locale}/products/${product['id']}`} className={s.productLink}>
                        {product['title']}
                      </Link>
                    ))}
                    {yearData.products.length > 3 && (
                      <span className={s.productMore}>+{yearData.products.length - 3}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ActressCareerTimeline;
