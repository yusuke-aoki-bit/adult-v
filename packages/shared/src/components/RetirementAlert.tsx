'use client';

import { AlertTriangle, Clock, TrendingDown, Calendar } from 'lucide-react';
import { useSiteTheme } from '../contexts/SiteThemeContext';
import { getTranslation, retirementAlertTranslations } from '../lib/translations';

interface CareerProduct {
  id: number;
  title: string;
  releaseDate?: string;
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

interface RetirementAlertProps {
  career: CareerAnalysis;
  actressName: string;
  locale: string;
  theme?: 'dark' | 'light';
}

const themes = {
  dark: {
    bgColor: {
      warning: 'bg-yellow-900/30 border-yellow-500/30',
      danger: 'bg-orange-900/30 border-orange-500/30',
      critical: 'bg-red-900/30 border-red-500/30',
    },
    iconColor: {
      warning: 'text-yellow-400',
      danger: 'text-orange-400',
      critical: 'text-red-400',
    },
    textColor: {
      warning: 'text-yellow-300',
      danger: 'text-orange-300',
      critical: 'text-red-300',
    },
    description: 'text-sm text-gray-300 mt-1',
    detail: 'text-gray-400',
  },
  light: {
    bgColor: {
      warning: 'bg-yellow-50 border-yellow-300',
      danger: 'bg-orange-50 border-orange-300',
      critical: 'bg-red-50 border-red-300',
    },
    iconColor: {
      warning: 'text-yellow-600',
      danger: 'text-orange-600',
      critical: 'text-red-600',
    },
    textColor: {
      warning: 'text-yellow-800',
      danger: 'text-orange-800',
      critical: 'text-red-800',
    },
    description: 'text-sm text-gray-600 mt-1',
    detail: 'text-gray-500',
  },
};

export function RetirementAlert({ career, actressName: _actressName, locale, theme: themeProp }: RetirementAlertProps) {
  const { theme: contextTheme } = useSiteTheme();
  const theme = themeProp ?? contextTheme;
  const t = getTranslation(retirementAlertTranslations, locale);
  const s = themes[theme];

  if (career.isActive) return null;
  if (!career.monthsSinceLastRelease || career.monthsSinceLastRelease < 3) return null;

  const getAlertLevel = (): { level: 'warning' | 'danger' | 'critical'; message: string } => {
    if (career.monthsSinceLastRelease! >= 12) {
      return { level: 'critical', message: t.warning12Months };
    } else if (career.monthsSinceLastRelease! >= 6) {
      return { level: 'danger', message: t.warning6Months };
    }
    return { level: 'warning', message: t.warning3Months };
  };

  const { level, message } = getAlertLevel();

  const currentYearStats = career.yearlyStats[career.yearlyStats.length - 1];
  const declinePercent =
    career.peakYearCount > 0 && currentYearStats
      ? Math.round((1 - currentYearStats.count / career.peakYearCount) * 100)
      : null;

  const bgColor = s.bgColor[level];
  const iconColor = s.iconColor[level];
  const textColor = s.textColor[level];

  return (
    <div className={`rounded-lg border p-4 ${bgColor}`}>
      <div className="flex items-start gap-3">
        <AlertTriangle className={`h-5 w-5 ${iconColor} mt-0.5 shrink-0`} />
        <div className="flex-1">
          <h4 className={`font-bold ${textColor}`}>{t.retirementAlert}</h4>
          <p className={s.description}>{message}</p>

          <div className="mt-3 space-y-2 text-sm">
            <div className={`flex items-center gap-2 ${s.detail}`}>
              <Clock className="h-4 w-4" />
              <span>
                {t.lastRelease}: {career.monthsSinceLastRelease}
                {t.monthsAgo}
              </span>
            </div>

            {declinePercent !== null && declinePercent > 50 && career.peakYear && (
              <div className={`flex items-center gap-2 ${s.detail}`}>
                <TrendingDown className="h-4 w-4" />
                <span>
                  {t.peakComparison.replace('{year}', String(career.peakYear))} {declinePercent}% {t.decline}
                </span>
              </div>
            )}

            {career.latestProduct && (
              <div className={`flex items-center gap-2 ${s.detail}`}>
                <Calendar className="h-4 w-4" />
                <span className="truncate">{career.latestProduct.releaseDate?.split('T')[0]}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default RetirementAlert;
