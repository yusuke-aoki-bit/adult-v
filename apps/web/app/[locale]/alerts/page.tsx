'use client';

import { useState, useCallback, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { usePriceAlerts, type PriceAlert } from '@adult-v/shared/hooks';
import { HomeSectionManager } from '@adult-v/shared/components';

interface AlertsPageClientProps {
  locale: string;
}

function AlertsPageClient({ locale }: AlertsPageClientProps) {
  const router = useRouter();
  const { alerts, removeAlert } = usePriceAlerts();
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  const handleProductClick = useCallback((id: string | number) => {
    router.push(`/${locale}/products/${id}`);
  }, [router, locale]);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString(locale === 'ja' ? 'ja-JP' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatPrice = (price: number) => {
    return `¥${price.toLocaleString()}`;
  };

  const handleClearAll = () => {
    if (confirm(locale === 'ja' ? 'すべてのアラートを削除しますか？' : 'Clear all alerts?')) {
      alerts.forEach((alert: PriceAlert) => removeAlert(alert.productId));
    }
  };

  if (!isLoaded) {
    return (
      <main className="min-h-screen theme-bg">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center gap-2">
            <svg className="animate-spin w-5 h-5 theme-text" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="theme-text">
              {locale === 'ja' ? '読み込み中...' : 'Loading...'}
            </span>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen theme-bg">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold theme-text mb-1 flex items-center gap-2">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {locale === 'ja' ? '価格アラート' : 'Price Alerts'}
            </h1>
            <p className="theme-text-secondary">
              {locale === 'ja'
                ? `${alerts.length}件のアラートが設定されています`
                : `${alerts.length} alerts set`}
            </p>
          </div>

          {/* Actions */}
          {alerts.length > 0 && (
            <div className="flex justify-end mb-4">
              <button
                onClick={handleClearAll}
                className="px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors"
              >
                {locale === 'ja' ? 'すべて削除' : 'Clear All'}
              </button>
            </div>
          )}

          {/* Alert List */}
          {alerts.length === 0 ? (
            <div className="text-center py-16 bg-gray-800 rounded-lg border border-gray-700">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <p className="theme-text-secondary text-lg mb-2">
                {locale === 'ja' ? 'アラートはありません' : 'No alerts'}
              </p>
              <p className="theme-text-muted text-sm">
                {locale === 'ja'
                  ? '作品ページでベルアイコンを押すと、価格アラートを設定できます'
                  : 'Click the bell icon on product pages to set price alerts'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert: PriceAlert) => (
                <div
                  key={alert.productId}
                  className="flex gap-4 p-4 bg-gray-800 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors"
                >
                  {/* Thumbnail */}
                  <div
                    className="w-20 sm:w-24 shrink-0 cursor-pointer"
                    onClick={() => handleProductClick(alert.productId)}
                  >
                    {alert.thumbnailUrl ? (
                      <img
                        src={alert.thumbnailUrl}
                        alt={alert.title}
                        className="w-full aspect-3/4 object-cover rounded"
                      />
                    ) : (
                      <div className="w-full aspect-3/4 bg-gray-700 rounded flex items-center justify-center">
                        <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3
                      className="font-medium theme-text line-clamp-2 cursor-pointer hover:text-blue-400 transition-colors"
                      onClick={() => handleProductClick(alert.productId)}
                    >
                      {alert.title}
                    </h3>

                    <div className="mt-2 space-y-1">
                      {alert.targetPrice && (
                        <p className="text-sm">
                          <span className="theme-text-muted">
                            {locale === 'ja' ? '目標価格: ' : 'Target: '}
                          </span>
                          <span className="text-yellow-400 font-semibold">
                            {formatPrice(alert.targetPrice)}
                          </span>
                        </p>
                      )}
                      {alert.currentPrice !== undefined && (
                        <p className="text-sm">
                          <span className="theme-text-muted">
                            {locale === 'ja' ? '現在価格: ' : 'Current: '}
                          </span>
                          <span className="theme-text">
                            {formatPrice(alert.currentPrice)}
                          </span>
                        </p>
                      )}
                      <p className="text-sm theme-text-muted">
                        {locale === 'ja' ? '設定日: ' : 'Set: '}
                        {formatDate(alert.createdAt)}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => handleProductClick(alert.productId)}
                      className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                    >
                      {locale === 'ja' ? '見る' : 'View'}
                    </button>
                    <button
                      onClick={() => removeAlert(alert.productId)}
                      className="px-3 py-1.5 text-sm text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
                    >
                      {locale === 'ja' ? '削除' : 'Remove'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* セクションカスタマイズ */}
      <div className="container mx-auto px-4 pb-8">
        <HomeSectionManager locale={locale} theme="dark" pageId="alerts" />
      </div>
    </main>
  );
}

export default function AlertsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);

  return <AlertsPageClient locale={locale} />;
}
