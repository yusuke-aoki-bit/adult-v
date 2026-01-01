'use client';

import { AlertTriangle, Clock, TrendingDown, Calendar } from 'lucide-react';

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

const translations = {
  ja: {
    retirementAlert: '活動休止の可能性',
    lastRelease: '最終リリース',
    monthsAgo: 'ヶ月前',
    noNewRelease: '新作リリースなし',
    warning3Months: '3ヶ月以上新作がありません',
    warning6Months: '6ヶ月以上新作がありません',
    warning12Months: '1年以上新作がありません',
    checkNow: '未視聴作品をチェック',
    activityDecline: 'リリース頻度が低下',
    peakComparison: '全盛期（{year}年）と比較して',
    decline: '減少',
  },
  en: {
    retirementAlert: 'Possible Retirement',
    lastRelease: 'Last Release',
    monthsAgo: 'months ago',
    noNewRelease: 'No new releases',
    warning3Months: 'No new releases for 3+ months',
    warning6Months: 'No new releases for 6+ months',
    warning12Months: 'No new releases for 1+ year',
    checkNow: 'Check unwatched products',
    activityDecline: 'Release frequency declining',
    peakComparison: 'Compared to peak ({year})',
    decline: 'decline',
  },
  zh: {
    retirementAlert: '可能已引退',
    lastRelease: '最后发布',
    monthsAgo: '个月前',
    noNewRelease: '无新作',
    warning3Months: '3个月以上无新作',
    warning6Months: '6个月以上无新作',
    warning12Months: '1年以上无新作',
    checkNow: '查看未观看的作品',
    activityDecline: '发布频率下降',
    peakComparison: '与巅峰期（{year}年）相比',
    decline: '减少',
  },
  ko: {
    retirementAlert: '은퇴 가능성',
    lastRelease: '마지막 발매',
    monthsAgo: '개월 전',
    noNewRelease: '신작 없음',
    warning3Months: '3개월 이상 신작이 없습니다',
    warning6Months: '6개월 이상 신작이 없습니다',
    warning12Months: '1년 이상 신작이 없습니다',
    checkNow: '미시청 작품 확인',
    activityDecline: '발매 빈도 감소',
    peakComparison: '전성기({year}년)와 비교하여',
    decline: '감소',
  },
} as const;

type TranslationKey = keyof typeof translations;

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

export function RetirementAlert({
  career,
  actressName: _actressName,
  locale,
  theme = 'dark',
}: RetirementAlertProps) {
  const t = translations[locale as TranslationKey] || translations.ja;
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
  const declinePercent = career.peakYearCount > 0 && currentYearStats
    ? Math.round((1 - currentYearStats.count / career.peakYearCount) * 100)
    : null;

  const bgColor = s.bgColor[level];
  const iconColor = s.iconColor[level];
  const textColor = s.textColor[level];

  return (
    <div className={`rounded-lg border p-4 ${bgColor}`}>
      <div className="flex items-start gap-3">
        <AlertTriangle className={`w-5 h-5 ${iconColor} shrink-0 mt-0.5`} />
        <div className="flex-1">
          <h4 className={`font-bold ${textColor}`}>
            {t.retirementAlert}
          </h4>
          <p className={s.description}>
            {message}
          </p>

          <div className="mt-3 space-y-2 text-sm">
            <div className={`flex items-center gap-2 ${s.detail}`}>
              <Clock className="w-4 h-4" />
              <span>{t.lastRelease}: {career.monthsSinceLastRelease}{t.monthsAgo}</span>
            </div>

            {declinePercent !== null && declinePercent > 50 && career.peakYear && (
              <div className={`flex items-center gap-2 ${s.detail}`}>
                <TrendingDown className="w-4 h-4" />
                <span>
                  {t.peakComparison.replace('{year}', String(career.peakYear))} {declinePercent}% {t.decline}
                </span>
              </div>
            )}

            {career.latestProduct && (
              <div className={`flex items-center gap-2 ${s.detail}`}>
                <Calendar className="w-4 h-4" />
                <span className="truncate">
                  {career.latestProduct.releaseDate?.split('T')[0]}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default RetirementAlert;
