'use client';

import { useState, useEffect } from 'react';
import { SaleAlertButton, PriceHistoryChart, SalePrediction } from '@adult-v/shared/components';

interface PriceHistoryEntry {
  date: string;
  price: number;
  salePrice?: number;
  discountPercent?: number;
  aspName?: string;
}

interface PriceStats {
  lowestPrice: number;
  highestPrice: number;
  averagePrice: number;
  maxDiscountPercent: number;
  recordCount: number;
  firstRecorded: string;
  lastRecorded: string;
}

interface ProductPriceSectionProps {
  productId: string;
  normalizedProductId: string;
  title: string;
  thumbnailUrl?: string;
  currentPrice: number;
  salePrice?: number;
  locale?: string;
}

export default function ProductPriceSection({
  productId,
  normalizedProductId,
  title,
  thumbnailUrl,
  currentPrice,
  salePrice,
  locale = 'ja',
}: ProductPriceSectionProps) {
  const [history, setHistory] = useState<PriceHistoryEntry[]>([]);
  const [stats, setStats] = useState<PriceStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPriceHistory() {
      try {
        const response = await fetch(`/api/products/${normalizedProductId}/price-history`);
        if (response.ok) {
          const data = await response.json();
          setHistory(data.history || []);
          setStats(data.stats || null);
        }
      } catch (error) {
        console.error('Failed to fetch price history:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchPriceHistory();
  }, [normalizedProductId]);

  const translations = {
    ja: {
      priceTracking: '価格追跡',
      description: 'この商品の価格変動を追跡し、セール時に通知を受け取れます。',
      noHistory: '価格履歴の収集を開始しました。データが蓄積されると表示されます。',
    },
    en: {
      priceTracking: 'Price Tracking',
      description: 'Track price changes and get notified when this product goes on sale.',
      noHistory: 'Price tracking started. Data will be displayed as it accumulates.',
    },
    zh: {
      priceTracking: '价格追踪',
      description: '追踪此商品的价格变动，在促销时接收通知。',
      noHistory: '已开始收集价格历史。数据积累后将显示。',
    },
    ko: {
      priceTracking: '가격 추적',
      description: '이 상품의 가격 변동을 추적하고 세일 시 알림을 받으세요.',
      noHistory: '가격 추적을 시작했습니다. 데이터가 쌓이면 표시됩니다.',
    },
  };

  const t = translations[locale as keyof typeof translations] || translations['ja'];

  return (
    <div className="bg-gray-800 rounded-lg p-6 mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {t.priceTracking}
        </h2>
        <SaleAlertButton
          productId={productId}
          normalizedProductId={normalizedProductId}
          title={title}
          thumbnailUrl={thumbnailUrl}
          currentPrice={salePrice || currentPrice}
          locale={locale}
          theme="dark"
          size="md"
        />
      </div>

      <p className="text-gray-400 text-sm mb-4">{t.description}</p>

      {loading ? (
        <div className="h-[200px] bg-gray-700 rounded-lg animate-pulse" />
      ) : history.length > 0 ? (
        <PriceHistoryChart
          history={history}
          stats={stats}
          currentPrice={salePrice || currentPrice}
          locale={locale}
          theme="dark"
        />
      ) : (
        <div className="bg-gray-700/50 rounded-lg p-6 text-center">
          <svg className="w-12 h-12 text-gray-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-gray-500 text-sm">
            {t.noHistory}
          </p>
        </div>
      )}

      {/* Sale Prediction */}
      <div className="mt-6">
        <SalePrediction
          productId={normalizedProductId}
          locale={locale}
          theme="dark"
          compact={false}
        />
      </div>
    </div>
  );
}
