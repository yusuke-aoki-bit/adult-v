'use client';

import { DollarSign, Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface CostPerformanceCardProps {
  price: number;
  salePrice?: number | null;
  duration?: number; // minutes
  actressAvgPricePerMin?: number;
  genreAvgPricePerMin?: number;
  locale: string;
}

const translations = {
  ja: {
    costPerformance: 'コスパ分析',
    pricePerMin: '価格/分',
    currentPrice: '現在価格',
    duration: '収録時間',
    comparison: '比較',
    vsActress: 'この女優の平均',
    vsGenre: 'このジャンル平均',
    belowAvg: '平均以下',
    aboveAvg: '平均以上',
    average: '平均的',
    excellent: 'お得',
    good: 'まあまあ',
    expensive: '割高',
    minutes: '分',
    yen: '円',
    noDuration: '時間情報なし',
    cheaper: '安い',
    moreExpensive: '高い',
  },
  en: {
    costPerformance: 'Cost Performance',
    pricePerMin: 'Price/min',
    currentPrice: 'Current Price',
    duration: 'Duration',
    comparison: 'Comparison',
    vsActress: 'Actress avg',
    vsGenre: 'Genre avg',
    belowAvg: 'Below avg',
    aboveAvg: 'Above avg',
    average: 'Average',
    excellent: 'Great value',
    good: 'Fair',
    expensive: 'Pricey',
    minutes: 'min',
    yen: 'JPY',
    noDuration: 'No duration info',
    cheaper: 'cheaper',
    moreExpensive: 'more expensive',
  },
  zh: {
    costPerformance: '性价比分析',
    pricePerMin: '价格/分钟',
    currentPrice: '当前价格',
    duration: '时长',
    comparison: '比较',
    vsActress: '该女优平均',
    vsGenre: '该类型平均',
    belowAvg: '低于平均',
    aboveAvg: '高于平均',
    average: '平均',
    excellent: '超值',
    good: '一般',
    expensive: '偏贵',
    minutes: '分钟',
    yen: '日元',
    noDuration: '无时长信息',
    cheaper: '便宜',
    moreExpensive: '贵',
  },
  ko: {
    costPerformance: '가성비 분석',
    pricePerMin: '가격/분',
    currentPrice: '현재 가격',
    duration: '재생 시간',
    comparison: '비교',
    vsActress: '이 배우 평균',
    vsGenre: '이 장르 평균',
    belowAvg: '평균 이하',
    aboveAvg: '평균 이상',
    average: '평균',
    excellent: '알뜰',
    good: '보통',
    expensive: '비쌈',
    minutes: '분',
    yen: '엔',
    noDuration: '시간 정보 없음',
    cheaper: '저렴',
    moreExpensive: '비쌈',
  },
} as const;

type Translations = typeof translations;
type TranslationKey = keyof Translations;
type Translation = Translations[TranslationKey];

function getCostRating(
  pricePerMin: number,
  avgPricePerMin: number,
  t: Translation
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
  const t = translations[locale as TranslationKey] || translations.ja;

  const effectivePrice = salePrice || price;

  // 再生時間がない場合は簡易表示
  if (!duration || duration <= 0) {
    return null;
  }

  const pricePerMin = effectivePrice / duration;

  // 女優平均との比較
  const actressComparison = actressAvgPricePerMin
    ? getCostRating(pricePerMin, actressAvgPricePerMin, t)
    : null;

  const actressDiffPercent = actressAvgPricePerMin
    ? Math.round(((pricePerMin - actressAvgPricePerMin) / actressAvgPricePerMin) * 100)
    : null;

  // ジャンル平均との比較
  const genreComparison = genreAvgPricePerMin
    ? getCostRating(pricePerMin, genreAvgPricePerMin, t)
    : null;

  const genreDiffPercent = genreAvgPricePerMin
    ? Math.round(((pricePerMin - genreAvgPricePerMin) / genreAvgPricePerMin) * 100)
    : null;

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-white font-bold mb-4 flex items-center gap-2">
        <DollarSign className="w-5 h-5 text-emerald-400" />
        {t.costPerformance}
      </h3>

      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* 価格/分 */}
        <div className="bg-gray-750 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-emerald-400">
            {t.yen === '円' ? '¥' : ''}{pricePerMin.toFixed(1)}
          </div>
          <div className="text-xs text-gray-400">{t.pricePerMin}</div>
        </div>

        {/* 収録時間 */}
        <div className="bg-gray-750 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-white flex items-center justify-center gap-1">
            <Clock className="w-5 h-5 text-gray-400" />
            {duration}
          </div>
          <div className="text-xs text-gray-400">{t.duration} ({t.minutes})</div>
        </div>
      </div>

      {/* 比較セクション */}
      {(actressComparison || genreComparison) && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-400">{t.comparison}</h4>

          {/* 女優平均との比較 */}
          {actressComparison && actressDiffPercent !== null && (
            <div className="flex items-center justify-between bg-gray-750 rounded p-2">
              <span className="text-sm text-gray-300">{t.vsActress}</span>
              <div className="flex items-center gap-2">
                <actressComparison.icon className={`w-4 h-4 ${actressComparison.colorClass}`} />
                <span className={`text-sm font-medium ${actressComparison.colorClass}`}>
                  {actressDiffPercent > 0 ? '+' : ''}{actressDiffPercent}%
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  actressDiffPercent <= 0
                    ? 'bg-green-900/50 text-green-400'
                    : 'bg-orange-900/50 text-orange-400'
                }`}>
                  {actressComparison.label}
                </span>
              </div>
            </div>
          )}

          {/* ジャンル平均との比較 */}
          {genreComparison && genreDiffPercent !== null && (
            <div className="flex items-center justify-between bg-gray-750 rounded p-2">
              <span className="text-sm text-gray-300">{t.vsGenre}</span>
              <div className="flex items-center gap-2">
                <genreComparison.icon className={`w-4 h-4 ${genreComparison.colorClass}`} />
                <span className={`text-sm font-medium ${genreComparison.colorClass}`}>
                  {genreDiffPercent > 0 ? '+' : ''}{genreDiffPercent}%
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  genreDiffPercent <= 0
                    ? 'bg-green-900/50 text-green-400'
                    : 'bg-orange-900/50 text-orange-400'
                }`}>
                  {genreComparison.label}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 価格の内訳 */}
      <div className="mt-4 pt-3 border-t border-gray-700 text-xs text-gray-500">
        <div className="flex justify-between">
          <span>{t.currentPrice}:</span>
          <span className="text-gray-300">
            {t.yen === '円' ? '¥' : ''}{effectivePrice.toLocaleString()}
            {salePrice && (
              <span className="ml-1 line-through text-gray-600">
                {t.yen === '円' ? '¥' : ''}{price.toLocaleString()}
              </span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
