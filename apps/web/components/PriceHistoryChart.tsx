'use client';

import { useState, useEffect } from 'react';
import { TrendingDown, TrendingUp, Minus, Calendar, AlertCircle, Loader2 } from 'lucide-react';

interface PriceHistory {
  recorded_at: string;
  price: number;
  asp_name: string;
  price_type: string;
}

interface PriceStats {
  min_price: number;
  max_price: number;
  avg_price: number;
  current_price: number;
  price_change_30d: number;
  last_sale_date: string | null;
  sale_count: number;
}

interface Props {
  productId: string;
  locale?: string;
  className?: string;
}

const translations = {
  ja: {
    title: '価格推移',
    loading: '読み込み中...',
    error: '価格履歴を取得できませんでした',
    noData: '価格履歴がありません',
    currentPrice: '現在価格',
    lowestPrice: '最安値',
    highestPrice: '最高値',
    avgPrice: '平均価格',
    priceChange: '30日間の変動',
    lastSale: '直近のセール',
    saleCount: 'セール回数',
    times: '回',
    yen: '円',
    days: '日前',
    priceAlert: '値下げ通知を設定',
  },
  en: {
    title: 'Price History',
    loading: 'Loading...',
    error: 'Failed to load price history',
    noData: 'No price history available',
    currentPrice: 'Current Price',
    lowestPrice: 'Lowest Price',
    highestPrice: 'Highest Price',
    avgPrice: 'Average Price',
    priceChange: '30-day Change',
    lastSale: 'Last Sale',
    saleCount: 'Sale Count',
    times: 'times',
    yen: 'JPY',
    days: 'days ago',
    priceAlert: 'Set Price Alert',
  },
};

export function PriceHistoryChart({ productId, locale = 'ja', className = '' }: Props) {
  const [history, setHistory] = useState<PriceHistory[]>([]);
  const [stats, setStats] = useState<PriceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const t = translations[locale as keyof typeof translations] || translations.ja;

  useEffect(() => {
    const fetchPriceHistory = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/products/${productId}/price-history?days=180`);
        const data = await response.json();

        if (data.success) {
          setHistory(data.history || []);
          setStats(data.stats || null);
        } else {
          setError(data.error || t.error);
        }
      } catch {
        setError(t.error);
      } finally {
        setLoading(false);
      }
    };

    fetchPriceHistory();
  }, [productId, t.error]);

  if (loading) {
    return (
      <div className={`rounded-lg theme-card p-4 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-400">{t.loading}</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`rounded-lg theme-card p-4 ${className}`}>
        <div className="flex items-center justify-center py-8 text-red-400">
          <AlertCircle className="w-5 h-5 mr-2" />
          {error}
        </div>
      </div>
    );
  }

  if (!stats || history.length === 0) {
    return (
      <div className={`rounded-lg theme-card p-4 ${className}`}>
        <h3 className="font-medium theme-text mb-2">{t.title}</h3>
        <p className="text-gray-400 text-sm">{t.noData}</p>
      </div>
    );
  }

  // 価格変動に基づくアイコンと色
  const priceChange = stats.price_change_30d || 0;
  const changeColor = priceChange < 0 ? 'text-green-400' : priceChange > 0 ? 'text-red-400' : 'text-gray-400';
  const ChangeIcon = priceChange < 0 ? TrendingDown : priceChange > 0 ? TrendingUp : Minus;

  // グラフ用のデータを準備（最大30ポイント）
  const chartData = history.slice(0, 30).reverse();
  const prices = chartData.map(h => h.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice || 1;

  // SVGパスを生成
  const chartWidth = 280;
  const chartHeight = 80;
  const points = chartData.map((h, i) => {
    const x = (i / (chartData.length - 1)) * chartWidth;
    const y = chartHeight - ((h.price - minPrice) / priceRange) * (chartHeight - 10);
    return `${x},${y}`;
  }).join(' ');

  const pathD = `M ${points}`;

  // 塗りつぶし用のパス
  const areaD = `M 0,${chartHeight} L ${points} L ${chartWidth},${chartHeight} Z`;

  return (
    <div className={`rounded-lg theme-card p-4 ${className}`}>
      <h3 className="font-medium theme-text mb-4 flex items-center gap-2">
        <TrendingDown className="w-5 h-5 text-green-400" />
        {t.title}
      </h3>

      {/* グラフ */}
      <div className="mb-4 bg-gray-800/50 rounded-lg p-3">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-20">
          {/* グリッド線 */}
          <line x1="0" y1={chartHeight/2} x2={chartWidth} y2={chartHeight/2} stroke="#374151" strokeWidth="0.5" strokeDasharray="4" />

          {/* 塗りつぶしエリア */}
          <path d={areaD} fill="url(#priceGradient)" opacity="0.3" />

          {/* 価格ライン */}
          <polyline
            points={points}
            fill="none"
            stroke="#10b981"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* グラデーション定義 */}
          <defs>
            <linearGradient id="priceGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>

        {/* 価格ラベル */}
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>180{locale === 'ja' ? '日前' : ' days ago'}</span>
          <span>{locale === 'ja' ? '現在' : 'Now'}</span>
        </div>
      </div>

      {/* 統計情報 */}
      <div className="grid grid-cols-2 gap-3">
        {/* 現在価格 */}
        <div className="bg-gray-800/30 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">{t.currentPrice}</p>
          <p className="text-lg font-bold text-white">
            ¥{stats.current_price?.toLocaleString() || '-'}
          </p>
        </div>

        {/* 30日変動 */}
        <div className="bg-gray-800/30 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">{t.priceChange}</p>
          <p className={`text-lg font-bold flex items-center gap-1 ${changeColor}`}>
            <ChangeIcon className="w-4 h-4" />
            {priceChange > 0 ? '+' : ''}{priceChange?.toLocaleString() || 0}{t.yen}
          </p>
        </div>

        {/* 最安値 */}
        <div className="bg-gray-800/30 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">{t.lowestPrice}</p>
          <p className="text-lg font-bold text-green-400">
            ¥{stats.min_price?.toLocaleString() || '-'}
          </p>
        </div>

        {/* 最高値 */}
        <div className="bg-gray-800/30 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">{t.highestPrice}</p>
          <p className="text-lg font-bold text-red-400">
            ¥{stats.max_price?.toLocaleString() || '-'}
          </p>
        </div>
      </div>

      {/* セール情報 */}
      {stats.sale_count > 0 && (
        <div className="mt-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <div className="flex items-center justify-between text-sm">
            <span className="text-yellow-300 flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {t.saleCount}: {stats.sale_count}{t.times}
            </span>
            {stats.last_sale_date && (
              <span className="text-gray-400">
                {t.lastSale}: {stats.last_sale_date}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default PriceHistoryChart;
