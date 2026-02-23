'use client';

import { DollarSign, Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { getTranslation, costPerformanceTranslations } from '../lib/translations';

interface CostPerformanceCardProps {
  price: number;
  salePrice?: number | null;
  duration?: number; // minutes
  actressAvgPricePerMin?: number;
  genreAvgPricePerMin?: number;
  locale: string;
}

type Translation = {
  costPerformance: string;
  pricePerMin: string;
  currentPrice: string;
  duration: string;
  comparison: string;
  vsActress: string;
  vsGenre: string;
  belowAvg: string;
  aboveAvg: string;
  average: string;
  excellent: string;
  good: string;
  expensive: string;
  minutes: string;
  yen: string;
  noDuration: string;
  cheaper: string;
  moreExpensive: string;
};

function getCostRating(
  pricePerMin: number,
  avgPricePerMin: number,
  t: Translation,
): { label: string; colorClass: string; icon: typeof TrendingUp } {
  const ratio = pricePerMin / avgPricePerMin;

  if (ratio < 0.8) {
    return { label: t.excellent, colorClass: 'text-green-400', icon: TrendingDown };
  } else if (ratio < 1.0) {
    return { label: t.good, colorClass: 'text-emerald-400', icon: TrendingDown };
  } else if (ratio <= 1.2) {
    return { label: t.average, colorClass: 'text-gray-400', icon: Minus };
  } else {
    return { label: t.expensive, colorClass: 'text-orange-400', icon: TrendingUp };
  }
}

export default function CostPerformanceCard({
  price,
  salePrice,
  duration,
  actressAvgPricePerMin,
  genreAvgPricePerMin,
  locale,
}: CostPerformanceCardProps) {
  const t = getTranslation(costPerformanceTranslations, locale);

  const effectivePrice = salePrice || price;

  // 再生時間がない場合は簡易表示
  if (!duration || duration <= 0) {
    return null;
  }

  const pricePerMin = effectivePrice / duration;

  // 女優平均との比較
  const actressComparison = actressAvgPricePerMin ? getCostRating(pricePerMin, actressAvgPricePerMin, t) : null;

  const actressDiffPercent = actressAvgPricePerMin
    ? Math.round(((pricePerMin - actressAvgPricePerMin) / actressAvgPricePerMin) * 100)
    : null;

  // ジャンル平均との比較
  const genreComparison = genreAvgPricePerMin ? getCostRating(pricePerMin, genreAvgPricePerMin, t) : null;

  const genreDiffPercent = genreAvgPricePerMin
    ? Math.round(((pricePerMin - genreAvgPricePerMin) / genreAvgPricePerMin) * 100)
    : null;

  return (
    <div className="rounded-lg bg-gray-800 p-4">
      <h3 className="mb-4 flex items-center gap-2 font-bold text-white">
        <DollarSign className="h-5 w-5 text-emerald-400" />
        {t.costPerformance}
      </h3>

      <div className="mb-4 grid grid-cols-2 gap-3">
        {/* 価格/分 */}
        <div className="bg-gray-750 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-emerald-400">
            {t.yen === '円' ? '¥' : ''}
            {pricePerMin.toFixed(1)}
          </div>
          <div className="text-xs text-gray-400">{t.pricePerMin}</div>
        </div>

        {/* 収録時間 */}
        <div className="bg-gray-750 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-2xl font-bold text-white">
            <Clock className="h-5 w-5 text-gray-400" />
            {duration}
          </div>
          <div className="text-xs text-gray-400">
            {t.duration} ({t.minutes})
          </div>
        </div>
      </div>

      {/* 比較セクション */}
      {(actressComparison || genreComparison) && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-400">{t.comparison}</h4>

          {/* 女優平均との比較 */}
          {actressComparison && actressDiffPercent !== null && (
            <div className="bg-gray-750 flex items-center justify-between rounded p-2">
              <span className="text-sm text-gray-300">{t.vsActress}</span>
              <div className="flex items-center gap-2">
                <actressComparison.icon className={`h-4 w-4 ${actressComparison.colorClass}`} />
                <span className={`text-sm font-medium ${actressComparison.colorClass}`}>
                  {actressDiffPercent > 0 ? '+' : ''}
                  {actressDiffPercent}%
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-xs ${
                    actressDiffPercent <= 0 ? 'bg-green-900/50 text-green-400' : 'bg-orange-900/50 text-orange-400'
                  }`}
                >
                  {actressComparison.label}
                </span>
              </div>
            </div>
          )}

          {/* ジャンル平均との比較 */}
          {genreComparison && genreDiffPercent !== null && (
            <div className="bg-gray-750 flex items-center justify-between rounded p-2">
              <span className="text-sm text-gray-300">{t.vsGenre}</span>
              <div className="flex items-center gap-2">
                <genreComparison.icon className={`h-4 w-4 ${genreComparison.colorClass}`} />
                <span className={`text-sm font-medium ${genreComparison.colorClass}`}>
                  {genreDiffPercent > 0 ? '+' : ''}
                  {genreDiffPercent}%
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-xs ${
                    genreDiffPercent <= 0 ? 'bg-green-900/50 text-green-400' : 'bg-orange-900/50 text-orange-400'
                  }`}
                >
                  {genreComparison.label}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 価格の内訳 */}
      <div className="mt-4 border-t border-gray-700 pt-3 text-xs text-gray-500">
        <div className="flex justify-between">
          <span>{t.currentPrice}:</span>
          <span className="text-gray-300">
            {t.yen === '円' ? '¥' : ''}
            {effectivePrice.toLocaleString()}
            {salePrice && (
              <span className="ml-1 text-gray-600 line-through">
                {t.yen === '円' ? '¥' : ''}
                {price.toLocaleString()}
              </span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
