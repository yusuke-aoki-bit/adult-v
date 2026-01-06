'use client';

import { useMemo } from 'react';

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
}

interface PriceHistoryChartProps {
  history: PriceHistoryEntry[];
  stats?: PriceStats | null;
  currentPrice?: number;
  locale?: string;
  theme?: 'dark' | 'light';
  height?: number;
  className?: string;
}

const TRANSLATIONS = {
  ja: {
    priceHistory: '価格履歴',
    noData: '価格履歴データがありません',
    lowestPrice: '最安値',
    highestPrice: '最高値',
    averagePrice: '平均価格',
    maxDiscount: '最大割引',
    currentPrice: '現在価格',
    regularPrice: '通常価格',
    salePrice: 'セール価格',
    months: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
  },
  en: {
    priceHistory: 'Price History',
    noData: 'No price history available',
    lowestPrice: 'Lowest',
    highestPrice: 'Highest',
    averagePrice: 'Average',
    maxDiscount: 'Max Discount',
    currentPrice: 'Current',
    regularPrice: 'Regular',
    salePrice: 'Sale',
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  },
  zh: {
    priceHistory: '价格历史',
    noData: '暂无价格历史数据',
    lowestPrice: '最低价',
    highestPrice: '最高价',
    averagePrice: '平均价',
    maxDiscount: '最大折扣',
    currentPrice: '当前价格',
    regularPrice: '原价',
    salePrice: '促销价',
    months: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
  },
  ko: {
    priceHistory: '가격 이력',
    noData: '가격 이력이 없습니다',
    lowestPrice: '최저가',
    highestPrice: '최고가',
    averagePrice: '평균가',
    maxDiscount: '최대 할인',
    currentPrice: '현재 가격',
    regularPrice: '정가',
    salePrice: '세일가',
    months: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
  },
};

export default function PriceHistoryChart({
  history,
  stats,
  currentPrice,
  locale = 'ja',
  theme = 'dark',
  height = 200,
  className = '',
}: PriceHistoryChartProps) {
  const t = TRANSLATIONS[locale as keyof typeof TRANSLATIONS] || TRANSLATIONS.ja;
  const isDark = theme === 'dark';

  // グラフデータの計算
  const chartData = useMemo(() => {
    if (!history || history.length === 0) return null;

    // 日付順にソート
    const sorted = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // 価格の最小・最大を計算
    const allPrices = sorted.flatMap((h) => [h.price, h.salePrice].filter(Boolean) as number[]);
    const minPrice = Math.min(...allPrices) * 0.9;
    const maxPrice = Math.max(...allPrices) * 1.1;
    const priceRange = maxPrice - minPrice;

    // SVGパスを生成
    const width = 100;
    const points = sorted.map((entry, i) => {
      const x = (i / (sorted.length - 1)) * width;
      const y = height - ((entry.salePrice || entry['price']) - minPrice) / priceRange * height;
      return { x, y, ...entry };
    });

    // パスを生成
    const linePath = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');

    // エリアパス（グラデーション用）
    const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;

    return {
      points,
      linePath,
      areaPath,
      minPrice: Math.floor(minPrice),
      maxPrice: Math.ceil(maxPrice),
      dates: sorted.map((h) => h.date),
    };
  }, [history, height]);

  if (!chartData) {
    return (
      <div className={`${isDark ? 'bg-gray-800/50' : 'bg-gray-100'} rounded-lg p-4 ${className}`}>
        <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{t.noData}</p>
      </div>
    );
  }

  return (
    <div className={`${isDark ? 'bg-gray-800/50' : 'bg-gray-50'} rounded-lg p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className={`font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
          </svg>
          {t.priceHistory}
        </h3>
        {currentPrice && (
          <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {t.currentPrice}: ¥{currentPrice.toLocaleString()}
          </span>
        )}
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className={`p-2 rounded-lg ${isDark ? 'bg-green-900/30' : 'bg-green-50'}`}>
            <p className={`text-xs ${isDark ? 'text-green-400' : 'text-green-600'}`}>{t.lowestPrice}</p>
            <p className={`font-bold ${isDark ? 'text-green-300' : 'text-green-700'}`}>
              ¥{stats.lowestPrice.toLocaleString()}
            </p>
          </div>
          <div className={`p-2 rounded-lg ${isDark ? 'bg-red-900/30' : 'bg-red-50'}`}>
            <p className={`text-xs ${isDark ? 'text-red-400' : 'text-red-600'}`}>{t.highestPrice}</p>
            <p className={`font-bold ${isDark ? 'text-red-300' : 'text-red-700'}`}>
              ¥{stats.highestPrice.toLocaleString()}
            </p>
          </div>
          <div className={`p-2 rounded-lg ${isDark ? 'bg-blue-900/30' : 'bg-blue-50'}`}>
            <p className={`text-xs ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{t.averagePrice}</p>
            <p className={`font-bold ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
              ¥{stats.averagePrice.toLocaleString()}
            </p>
          </div>
          <div className={`p-2 rounded-lg ${isDark ? 'bg-yellow-900/30' : 'bg-yellow-50'}`}>
            <p className={`text-xs ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`}>{t.maxDiscount}</p>
            <p className={`font-bold ${isDark ? 'text-yellow-300' : 'text-yellow-700'}`}>
              {stats.maxDiscountPercent}%
            </p>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="relative" style={{ height }}>
        <svg
          viewBox={`0 0 100 ${height}`}
          className="w-full h-full"
          preserveAspectRatio="none"
        >
          {/* Gradient */}
          <defs>
            <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={isDark ? '#22c55e' : '#4ade80'} stopOpacity="0.3" />
              <stop offset="100%" stopColor={isDark ? '#22c55e' : '#4ade80'} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
            <line
              key={ratio}
              x1="0"
              y1={height * ratio}
              x2="100"
              y2={height * ratio}
              stroke={isDark ? '#374151' : '#e5e7eb'}
              strokeWidth="0.5"
              strokeDasharray="2,2"
            />
          ))}

          {/* Area fill */}
          <path d={chartData.areaPath} fill="url(#priceGradient)" />

          {/* Line */}
          <path
            d={chartData.linePath}
            fill="none"
            stroke={isDark ? '#22c55e' : '#16a34a'}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data points */}
          {chartData.points.map((point, i) => (
            <circle
              key={i}
              cx={point.x}
              cy={point.y}
              r="1.5"
              fill={point.salePrice ? '#ef4444' : isDark ? '#22c55e' : '#16a34a'}
            />
          ))}
        </svg>

        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-xs pointer-events-none">
          <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>¥{chartData.maxPrice.toLocaleString()}</span>
          <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>¥{chartData.minPrice.toLocaleString()}</span>
        </div>
      </div>

      {/* X-axis labels */}
      <div className="flex justify-between mt-2">
        <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          {chartData.dates[0]}
        </span>
        <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          {chartData.dates[chartData.dates.length - 1]}
        </span>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-3 text-xs">
        <div className="flex items-center gap-1">
          <span className={`w-3 h-3 rounded-full ${isDark ? 'bg-green-500' : 'bg-green-600'}`}></span>
          <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>{t.regularPrice}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-red-500"></span>
          <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>{t.salePrice}</span>
        </div>
      </div>
    </div>
  );
}
