'use client';

import { useState, useEffect } from 'react';
import { useSiteTheme } from '../contexts/SiteThemeContext';

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

const TRANSLATIONS = {
  ja: {
    salePrediction: 'セール予測',
    description: '過去のセールパターンに基づく予測',
    probability: 'セール確率',
    in30Days: '30日以内',
    in90Days: '90日以内',
    typicalDiscount: '平均割引率',
    nextLikelySale: '次回セール予想',
    historicalSales: '過去のセール履歴',
    noHistory: 'セール履歴がありません',
    avgDuration: '平均セール期間',
    days: '日',
    waitRecommended: '待つのがおすすめ',
    buyNow: '今が買い時',
    uncertain: '予測困難',
    loading: '予測中...',
  },
  en: {
    salePrediction: 'Sale Prediction',
    description: 'Based on historical sale patterns',
    probability: 'Sale probability',
    in30Days: 'Within 30 days',
    in90Days: 'Within 90 days',
    typicalDiscount: 'Typical discount',
    nextLikelySale: 'Next likely sale',
    historicalSales: 'Historical sales',
    noHistory: 'No sale history',
    avgDuration: 'Avg sale duration',
    days: 'days',
    waitRecommended: 'Wait recommended',
    buyNow: 'Good time to buy',
    uncertain: 'Uncertain',
    loading: 'Predicting...',
  },
  zh: {
    salePrediction: '促销预测',
    description: '基于历史促销模式',
    probability: '促销概率',
    in30Days: '30天内',
    in90Days: '90天内',
    typicalDiscount: '平均折扣',
    nextLikelySale: '下次预计促销',
    historicalSales: '历史促销记录',
    noHistory: '暂无促销记录',
    avgDuration: '平均促销时长',
    days: '天',
    waitRecommended: '建议等待',
    buyNow: '现在购买合适',
    uncertain: '难以预测',
    loading: '预测中...',
  },
  ko: {
    salePrediction: '세일 예측',
    description: '과거 세일 패턴 기반',
    probability: '세일 확률',
    in30Days: '30일 이내',
    in90Days: '90일 이내',
    typicalDiscount: '평균 할인율',
    nextLikelySale: '다음 예상 세일',
    historicalSales: '과거 세일 이력',
    noHistory: '세일 이력 없음',
    avgDuration: '평균 세일 기간',
    days: '일',
    waitRecommended: '기다리는 것이 좋음',
    buyNow: '지금이 구매 적기',
    uncertain: '예측 어려움',
    loading: '예측 중...',
  },
};

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

  const t = TRANSLATIONS[locale as keyof typeof TRANSLATIONS] || TRANSLATIONS.ja;
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
        <div className="h-5 bg-gray-700 rounded w-1/3 mb-3" />
        <div className="h-16 bg-gray-700 rounded" />
      </div>
    );
  }

  if (!data || data.totalHistoricalSales === 0) {
    return null;
  }

  const recommendation = getRecommendation();

  if (compact) {
    return (
      <div className={`flex items-center gap-3 p-3 rounded-lg ${isDark ? 'bg-purple-900/30 border border-purple-700/30' : 'bg-purple-50 border border-purple-200'}`}>
        <div className={`p-2 rounded-full ${isDark ? 'bg-purple-800' : 'bg-purple-100'}`}>
          <svg className={`w-5 h-5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <div className="flex-1">
          <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            {t.in30Days}: <span className={`font-bold ${getProbabilityColor(data.probability30Days)}`}>{data.probability30Days}%</span>
          </p>
        </div>
        <div className={`px-2 py-1 rounded text-xs font-medium ${
          recommendation.color === 'green' ? (isDark ? 'bg-green-900/50 text-green-400' : 'bg-green-100 text-green-700') :
          recommendation.color === 'blue' ? (isDark ? 'bg-blue-900/50 text-blue-400' : 'bg-blue-100 text-blue-700') :
          (isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-600')
        }`}>
          {recommendation.text}
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg p-6 ${isDark ? 'bg-linear-to-br from-purple-900/30 to-indigo-900/30 border border-purple-700/30' : 'bg-linear-to-br from-purple-50 to-indigo-50 border border-purple-200'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-lg font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          {t.salePrediction}
        </h3>
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${
          recommendation.color === 'green' ? (isDark ? 'bg-green-900/50 text-green-400' : 'bg-green-100 text-green-700') :
          recommendation.color === 'blue' ? (isDark ? 'bg-blue-900/50 text-blue-400' : 'bg-blue-100 text-blue-700') :
          (isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-600')
        }`}>
          {recommendation.text}
        </div>
      </div>

      <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
        {t.description}
      </p>

      {/* Probability Cards */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800/50' : 'bg-white/80'}`}>
          <p className={`text-xs mb-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{t.in30Days}</p>
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
                data.probability30Days >= 60 ? 'bg-green-500' :
                data.probability30Days >= 30 ? 'bg-yellow-500' : 'bg-gray-500'
              }`}
              style={{ width: `${data.probability30Days}%` }}
            />
          </div>
        </div>
        <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800/50' : 'bg-white/80'}`}>
          <p className={`text-xs mb-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{t.in90Days}</p>
          <div className="flex items-end gap-2">
            <span className={`text-3xl font-bold ${getProbabilityColor(data.probability90Days)}`}>
              {data.probability90Days}
            </span>
            <span className={`text-lg ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>%</span>
          </div>
          <div className={`mt-2 h-1.5 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
            <div
              className={`h-full rounded-full transition-all ${
                data.probability90Days >= 60 ? 'bg-green-500' :
                data.probability90Days >= 30 ? 'bg-yellow-500' : 'bg-gray-500'
              }`}
              style={{ width: `${data.probability90Days}%` }}
            />
          </div>
        </div>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className={`p-3 rounded-lg ${isDark ? 'bg-gray-800/50' : 'bg-white/80'} text-center`}>
          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{t.typicalDiscount}</p>
          <p className={`text-lg font-bold ${isDark ? 'text-red-400' : 'text-red-600'}`}>
            {data.typicalDiscountPercent}%
          </p>
        </div>
        <div className={`p-3 rounded-lg ${isDark ? 'bg-gray-800/50' : 'bg-white/80'} text-center`}>
          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{t.avgDuration}</p>
          <p className={`text-lg font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
            {data.averageSaleDurationDays}{t.days}
          </p>
        </div>
        <div className={`p-3 rounded-lg ${isDark ? 'bg-gray-800/50' : 'bg-white/80'} text-center`}>
          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{t.historicalSales}</p>
          <p className={`text-lg font-bold ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
            {data.totalHistoricalSales}回
          </p>
        </div>
      </div>

      {/* Next Likely Sale */}
      {data.nextLikelySalePeriod && (
        <div className={`mt-4 p-3 rounded-lg ${isDark ? 'bg-yellow-900/30 border border-yellow-700/30' : 'bg-yellow-50 border border-yellow-200'}`}>
          <p className={`text-sm ${isDark ? 'text-yellow-400' : 'text-yellow-700'}`}>
            <span className="font-medium">{t.nextLikelySale}:</span> {data.nextLikelySalePeriod}
          </p>
        </div>
      )}
    </div>
  );
}
