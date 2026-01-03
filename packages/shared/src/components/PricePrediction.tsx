'use client';

import { useState, useEffect } from 'react';

interface PricePredictionProps {
  productId: string | number;
  currentPrice: number;
  locale: string;
  theme?: 'dark' | 'light';
}

interface PredictionData {
  predictedPrice: number;
  confidence: number;
  trend: 'up' | 'down' | 'stable';
  bestTimeToBuy: string | null;
  historicalLow: number;
  historicalHigh: number;
  priceHistory: Array<{ date: string; price: number }>;
  salePattern: string;
}

export function PricePrediction({
  productId,
  currentPrice,
  locale,
  theme = 'dark',
}: PricePredictionProps) {
  const [data, setData] = useState<PredictionData | null>(null);
  const [loading, setLoading] = useState(true);

  const isDark = theme === 'dark';

  const t = {
    title: locale === 'ja' ? '価格予測' : 'Price Prediction',
    currentPrice: locale === 'ja' ? '現在価格' : 'Current Price',
    predictedPrice: locale === 'ja' ? '予測価格' : 'Predicted Price',
    confidence: locale === 'ja' ? '信頼度' : 'Confidence',
    bestTime: locale === 'ja' ? '購入おすすめ時期' : 'Best Time to Buy',
    historicalLow: locale === 'ja' ? '過去最安値' : 'Historical Low',
    historicalHigh: locale === 'ja' ? '過去最高値' : 'Historical High',
    salePattern: locale === 'ja' ? 'セールパターン' : 'Sale Pattern',
    loading: locale === 'ja' ? '分析中...' : 'Analyzing...',
    buyNow: locale === 'ja' ? '今が買い時！' : 'Buy Now!',
    waitForSale: locale === 'ja' ? 'セールを待つのがおすすめ' : 'Wait for Sale',
    priceUp: locale === 'ja' ? '値上がり傾向' : 'Price Rising',
    priceDown: locale === 'ja' ? '値下がり傾向' : 'Price Dropping',
    priceStable: locale === 'ja' ? '価格安定' : 'Price Stable',
    patterns: {
      regular: locale === 'ja' ? '定期的にセール' : 'Regular Sales',
      rare: locale === 'ja' ? 'セール稀' : 'Rare Sales',
      seasonal: locale === 'ja' ? '季節セール' : 'Seasonal Sales',
      unknown: locale === 'ja' ? 'パターン不明' : 'Unknown Pattern',
    },
  };

  useEffect(() => {
    const fetchPrediction = async () => {
      setLoading(true);
      try {
        // 実際のAPIが実装されるまでのモックデータ
        await new Promise(resolve => setTimeout(resolve, 500));

        // モック予測データ（実際にはAPIから取得）
        const mockData: PredictionData = {
          predictedPrice: currentPrice * 0.7, // 30%オフを予測
          confidence: 75,
          trend: Math.random() > 0.5 ? 'down' : 'stable',
          bestTimeToBuy: locale === 'ja' ? '来週のセール期間' : 'Next week sale period',
          historicalLow: currentPrice * 0.5,
          historicalHigh: currentPrice * 1.2,
          priceHistory: Array.from({ length: 30 }, (_, i) => ({
            date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            price: currentPrice * (0.8 + Math.random() * 0.4),
          })),
          salePattern: 'regular',
        };

        setData(mockData);
      } catch (error) {
        console.error('Failed to fetch price prediction:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPrediction();
  }, [productId, currentPrice, locale]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat(locale === 'ja' ? 'ja-JP' : 'en-US', {
      style: 'currency',
      currency: 'JPY',
      maximumFractionDigits: 0,
    }).format(price);
  };

  if (loading) {
    return (
      <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
        <div className="flex items-center gap-2">
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>{t.loading}</span>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const isPriceGood = data.predictedPrice >= currentPrice * 0.95;
  const savingsPercent = Math.round((1 - data.predictedPrice / currentPrice) * 100);

  return (
    <div className={`rounded-lg overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
      {/* Header */}
      <div className={`p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
        <h3 className={`font-semibold flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          {t.title}
        </h3>
      </div>

      <div className="p-4 space-y-4">
        {/* 買い時アドバイス */}
        <div className={`p-3 rounded-lg ${
          isPriceGood
            ? isDark ? 'bg-green-600/20 border border-green-600/30' : 'bg-green-50 border border-green-200'
            : isDark ? 'bg-yellow-600/20 border border-yellow-600/30' : 'bg-yellow-50 border border-yellow-200'
        }`}>
          <div className="flex items-center gap-2">
            {isPriceGood ? (
              <svg className={`w-5 h-5 ${isDark ? 'text-green-400' : 'text-green-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className={`w-5 h-5 ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <span className={`font-medium ${
              isPriceGood
                ? isDark ? 'text-green-300' : 'text-green-700'
                : isDark ? 'text-yellow-300' : 'text-yellow-700'
            }`}>
              {isPriceGood ? t.buyNow : t.waitForSale}
            </span>
          </div>
          {!isPriceGood && savingsPercent > 0 && (
            <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {locale === 'ja'
                ? `約${savingsPercent}%お得に購入できる可能性があります`
                : `You could save about ${savingsPercent}%`}
            </p>
          )}
        </div>

        {/* 価格比較 */}
        <div className="grid grid-cols-2 gap-3">
          <div className={`p-3 rounded-lg ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t.currentPrice}</p>
            <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {formatPrice(currentPrice)}
            </p>
          </div>
          <div className={`p-3 rounded-lg ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t.predictedPrice}</p>
            <p className={`text-lg font-bold ${
              data.predictedPrice < currentPrice
                ? isDark ? 'text-green-400' : 'text-green-600'
                : isDark ? 'text-white' : 'text-gray-900'
            }`}>
              {formatPrice(data.predictedPrice)}
            </p>
          </div>
        </div>

        {/* 信頼度 */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t.confidence}</span>
            <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {data.confidence}%
            </span>
          </div>
          <div className={`h-2 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
            <div
              className={`h-full rounded-full ${
                data.confidence >= 70
                  ? isDark ? 'bg-green-500' : 'bg-green-600'
                  : data.confidence >= 40
                    ? isDark ? 'bg-yellow-500' : 'bg-yellow-600'
                    : isDark ? 'bg-red-500' : 'bg-red-600'
              }`}
              style={{ width: `${data.confidence}%` }}
            />
          </div>
        </div>

        {/* 追加情報 */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className={`flex items-center gap-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            <span>{t.historicalLow}:</span>
            <span className={isDark ? 'text-green-400' : 'text-green-600'}>{formatPrice(data.historicalLow)}</span>
          </div>
          <div className={`flex items-center gap-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            <span>{t.salePattern}:</span>
            <span className={isDark ? 'text-white' : 'text-gray-900'}>
              {t.patterns[data.salePattern as keyof typeof t.patterns] || t.patterns.unknown}
            </span>
          </div>
        </div>

        {/* ベストタイミング */}
        {data.bestTimeToBuy && (
          <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            <span>{t.bestTime}: </span>
            <span className={isDark ? 'text-blue-400' : 'text-pink-600'}>{data.bestTimeToBuy}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default PricePrediction;
