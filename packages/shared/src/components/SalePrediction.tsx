'use client';

import { useState, useEffect } from 'react';
import { useSiteTheme } from '../contexts/SiteThemeContext';
import { getTranslation, salePredictionTranslations } from '../lib/translations';

interface SalePredictionData {
  probability30Days: number;
  probability90Days: number;
  typicalDiscountPercent: number;
  nextLikelySalePeriod: string | null;
  historicalSaleDates: string[];
  averageSaleDurationDays: number;
  totalHistoricalSales: number;
}

interface SalePredictionProps {
  productId: string;
  locale?: string;
  theme?: 'dark' | 'light';
  compact?: boolean;
}


export default function SalePrediction({
  productId,
  locale = 'ja',
  theme: themeProp,
  compact = false,
}: SalePredictionProps) {
  const { theme: contextTheme } = useSiteTheme();
  const theme = themeProp ?? contextTheme;
  const [data, setData] = useState<SalePredictionData | null>(null);
  const [loading, setLoading] = useState(true);

  const t = getTranslation(salePredictionTranslations, locale);
  const isDark = theme === 'dark';

  useEffect(() => {
    async function fetchPrediction() {
      try {
        const response = await fetch(`/api/products/${productId}/sale-prediction`);
        if (response.ok) {
          const result = await response.json();
          setData(result);
        }
      } catch (error) {
        console.error('Failed to fetch sale prediction:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchPrediction();
  }, [productId]);

  const getRecommendation = () => {
    if (!data) return { text: t.uncertain, color: 'gray' };
    if (data.probability30Days >= 60) {
      return { text: t.waitRecommended, color: 'green' };
    }
    if (data.probability30Days <= 20 && data.probability90Days <= 40) {
      return { text: t.buyNow, color: 'blue' };
    }
    return { text: t.uncertain, color: 'gray' };
  };

  const getProbabilityColor = (prob: number) => {
    if (prob >= 60) return isDark ? 'text-green-400' : 'text-green-600';
    if (prob >= 30) return isDark ? 'text-yellow-400' : 'text-yellow-600';
    return isDark ? 'text-gray-400' : 'text-gray-500';
  };

  if (loading) {
    return (
      <div className={`rounded-lg p-4 ${isDark ? 'bg-gray-800' : 'bg-gray-100'} animate-pulse`}>
        <div className="mb-3 h-5 w-1/3 rounded bg-gray-700" />
        <div className="h-16 rounded bg-gray-700" />
      </div>
    );
  }

  if (!data || data.totalHistoricalSales === 0) {
    return null;
  }

  const recommendation = getRecommendation();

  if (compact) {
    return (
      <div
        className={`flex items-center gap-3 rounded-lg p-3 ${isDark ? 'border border-purple-700/30 bg-purple-900/30' : 'border border-purple-200 bg-purple-50'}`}
      >
        <div className={`rounded-full p-2 ${isDark ? 'bg-purple-800' : 'bg-purple-100'}`}>
          <svg
            className={`h-5 w-5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        </div>
        <div className="flex-1">
          <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            {t.in30Days}:{' '}
            <span className={`font-bold ${getProbabilityColor(data.probability30Days)}`}>
              {data.probability30Days}%
            </span>
          </p>
        </div>
        <div
          className={`rounded px-2 py-1 text-xs font-medium ${
            recommendation.color === 'green'
              ? isDark
                ? 'bg-green-900/50 text-green-400'
                : 'bg-green-100 text-green-700'
              : recommendation.color === 'blue'
                ? isDark
                  ? 'bg-blue-900/50 text-blue-400'
                  : 'bg-blue-100 text-blue-700'
                : isDark
                  ? 'bg-gray-700 text-gray-400'
                  : 'bg-gray-200 text-gray-600'
          }`}
        >
          {recommendation.text}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg p-6 ${isDark ? 'border border-purple-700/30 bg-linear-to-br from-purple-900/30 to-indigo-900/30' : 'border border-purple-200 bg-linear-to-br from-purple-50 to-indigo-50'}`}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className={`flex items-center gap-2 text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          <svg className="h-5 w-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          {t.salePrediction}
        </h3>
        <div
          className={`rounded-full px-3 py-1 text-sm font-medium ${
            recommendation.color === 'green'
              ? isDark
                ? 'bg-green-900/50 text-green-400'
                : 'bg-green-100 text-green-700'
              : recommendation.color === 'blue'
                ? isDark
                  ? 'bg-blue-900/50 text-blue-400'
                  : 'bg-blue-100 text-blue-700'
                : isDark
                  ? 'bg-gray-700 text-gray-400'
                  : 'bg-gray-200 text-gray-600'
          }`}
        >
          {recommendation.text}
        </div>
      </div>

      <p className={`mb-4 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t.description}</p>

      {/* Probability Cards */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className={`rounded-lg p-4 ${isDark ? 'bg-gray-800/50' : 'bg-white/80'}`}>
          <p className={`mb-1 text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{t.in30Days}</p>
          <div className="flex items-end gap-2">
            <span className={`text-3xl font-bold ${getProbabilityColor(data.probability30Days)}`}>
              {data.probability30Days}
            </span>
            <span className={`text-lg ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>%</span>
          </div>
          {/* Progress bar */}
          <div className={`mt-2 h-1.5 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
            <div
              className={`h-full rounded-full transition-all ${
                data.probability30Days >= 60
                  ? 'bg-green-500'
                  : data.probability30Days >= 30
                    ? 'bg-yellow-500'
                    : 'bg-gray-500'
              }`}
              style={{ width: `${data.probability30Days}%` }}
            />
          </div>
        </div>
        <div className={`rounded-lg p-4 ${isDark ? 'bg-gray-800/50' : 'bg-white/80'}`}>
          <p className={`mb-1 text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{t.in90Days}</p>
          <div className="flex items-end gap-2">
            <span className={`text-3xl font-bold ${getProbabilityColor(data.probability90Days)}`}>
              {data.probability90Days}
            </span>
            <span className={`text-lg ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>%</span>
          </div>
          <div className={`mt-2 h-1.5 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
            <div
              className={`h-full rounded-full transition-all ${
                data.probability90Days >= 60
                  ? 'bg-green-500'
                  : data.probability90Days >= 30
                    ? 'bg-yellow-500'
                    : 'bg-gray-500'
              }`}
              style={{ width: `${data.probability90Days}%` }}
            />
          </div>
        </div>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className={`rounded-lg p-3 ${isDark ? 'bg-gray-800/50' : 'bg-white/80'} text-center`}>
          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{t.typicalDiscount}</p>
          <p className={`text-lg font-bold ${isDark ? 'text-red-400' : 'text-red-600'}`}>
            {data.typicalDiscountPercent}%
          </p>
        </div>
        <div className={`rounded-lg p-3 ${isDark ? 'bg-gray-800/50' : 'bg-white/80'} text-center`}>
          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{t.avgDuration}</p>
          <p className={`text-lg font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
            {data.averageSaleDurationDays}
            {t.days}
          </p>
        </div>
        <div className={`rounded-lg p-3 ${isDark ? 'bg-gray-800/50' : 'bg-white/80'} text-center`}>
          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{t.historicalSales}</p>
          <p className={`text-lg font-bold ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
            {data.totalHistoricalSales}回
          </p>
        </div>
      </div>

      {/* Next Likely Sale */}
      {data.nextLikelySalePeriod && (
        <div
          className={`mt-4 rounded-lg p-3 ${isDark ? 'border border-yellow-700/30 bg-yellow-900/30' : 'border border-yellow-200 bg-yellow-50'}`}
        >
          <p className={`text-sm ${isDark ? 'text-yellow-400' : 'text-yellow-700'}`}>
            <span className="font-medium">{t.nextLikelySale}:</span> {data.nextLikelySalePeriod}
          </p>
        </div>
      )}
    </div>
  );
}
