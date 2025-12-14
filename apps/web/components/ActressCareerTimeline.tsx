'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Calendar, TrendingUp, Star, Clock, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import type { CareerAnalysis } from '@/lib/db/queries';

interface ActressCareerTimelineProps {
  career: CareerAnalysis;
  actressName: string;
  locale: string;
}

const translations = {
  ja: {
    title: 'キャリア分析',
    debut: 'デビュー',
    latest: '最新作',
    peakYear: '全盛期',
    totalProducts: '総作品数',
    avgPerYear: '年平均',
    products: '作品',
    active: '現役',
    inactive: '活動休止中',
    monthsAgo: 'ヶ月前',
    lastRelease: '最終リリース',
    showTimeline: 'タイムラインを表示',
    hideTimeline: 'タイムラインを非表示',
    yearLabel: '年',
    viewProduct: '詳細',
  },
  en: {
    title: 'Career Analysis',
    debut: 'Debut',
    latest: 'Latest',
    peakYear: 'Peak Year',
    totalProducts: 'Total Products',
    avgPerYear: 'Avg/Year',
    products: 'products',
    active: 'Active',
    inactive: 'Inactive',
    monthsAgo: 'months ago',
    lastRelease: 'Last Release',
    showTimeline: 'Show Timeline',
    hideTimeline: 'Hide Timeline',
    yearLabel: '',
    viewProduct: 'View',
  },
  zh: {
    title: '职业生涯分析',
    debut: '出道',
    latest: '最新作',
    peakYear: '巅峰期',
    totalProducts: '总作品数',
    avgPerYear: '年均',
    products: '部作品',
    active: '现役',
    inactive: '休止中',
    monthsAgo: '个月前',
    lastRelease: '最后发布',
    showTimeline: '显示时间线',
    hideTimeline: '隐藏时间线',
    yearLabel: '年',
    viewProduct: '查看',
  },
  ko: {
    title: '커리어 분석',
    debut: '데뷔',
    latest: '최신작',
    peakYear: '전성기',
    totalProducts: '총 작품 수',
    avgPerYear: '연평균',
    products: '작품',
    active: '현역',
    inactive: '활동 휴지',
    monthsAgo: '개월 전',
    lastRelease: '마지막 발매',
    showTimeline: '타임라인 보기',
    hideTimeline: '타임라인 숨기기',
    yearLabel: '년',
    viewProduct: '보기',
  },
} as const;

type TranslationKey = keyof typeof translations;

export default function ActressCareerTimeline({
  career,
  actressName,
  locale,
}: ActressCareerTimelineProps) {
  const t = translations[locale as TranslationKey] || translations.ja;
  const [showTimeline, setShowTimeline] = useState(false);

  // 最大作品数（グラフのスケール用）
  const maxCount = Math.max(...career.yearlyStats.map(y => y.count));

  return (
    <div className="bg-gray-800 rounded-lg p-4 sm:p-6">
      <h3 className="text-white font-bold mb-4 flex items-center gap-2">
        <Calendar className="w-5 h-5 text-blue-400" />
        {t.title}
      </h3>

      {/* サマリー統計 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {/* 総作品数 */}
        <div className="bg-gray-750 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-white">{career.totalProducts}</div>
          <div className="text-xs text-gray-400">{t.totalProducts}</div>
        </div>

        {/* 年平均 */}
        <div className="bg-gray-750 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-emerald-400">{career.averageProductsPerYear}</div>
          <div className="text-xs text-gray-400">{t.avgPerYear}</div>
        </div>

        {/* 全盛期 */}
        <div className="bg-gray-750 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-yellow-400 flex items-center justify-center gap-1">
            <Star className="w-4 h-4" />
            {career.peakYear}{t.yearLabel}
          </div>
          <div className="text-xs text-gray-400">{t.peakYear} ({career.peakYearCount}{t.products})</div>
        </div>

        {/* 活動状態 */}
        <div className="bg-gray-750 rounded-lg p-3 text-center">
          {career.isActive ? (
            <>
              <div className="text-2xl font-bold text-green-400 flex items-center justify-center gap-1">
                <TrendingUp className="w-4 h-4" />
                {t.active}
              </div>
              <div className="text-xs text-gray-400">{t.lastRelease}: {career.monthsSinceLastRelease}{t.monthsAgo}</div>
            </>
          ) : (
            <>
              <div className="text-2xl font-bold text-orange-400 flex items-center justify-center gap-1">
                <AlertTriangle className="w-4 h-4" />
                {t.inactive}
              </div>
              <div className="text-xs text-gray-400">{career.monthsSinceLastRelease}{t.monthsAgo}</div>
            </>
          )}
        </div>
      </div>

      {/* デビュー作 & 最新作 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        {career.debutProduct && (
          <Link
            href={`/${locale}/products/${career.debutProduct.id}`}
            className="flex items-center gap-3 bg-gray-750 hover:bg-gray-700 rounded-lg p-3 transition-colors group"
          >
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
              <Star className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-blue-400 font-medium">{t.debut} ({career.debutYear}{t.yearLabel})</div>
              <div className="text-sm text-white truncate group-hover:text-rose-300 transition-colors">
                {career.debutProduct.title}
              </div>
            </div>
          </Link>
        )}

        {career.latestProduct && (
          <Link
            href={`/${locale}/products/${career.latestProduct.id}`}
            className="flex items-center gap-3 bg-gray-750 hover:bg-gray-700 rounded-lg p-3 transition-colors group"
          >
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-rose-600 flex items-center justify-center">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-rose-400 font-medium">{t.latest}</div>
              <div className="text-sm text-white truncate group-hover:text-rose-300 transition-colors">
                {career.latestProduct.title}
              </div>
            </div>
          </Link>
        )}
      </div>

      {/* タイムライン表示切替 */}
      <button
        onClick={() => setShowTimeline(!showTimeline)}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-3 transition-colors"
      >
        {showTimeline ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
        {showTimeline ? t.hideTimeline : t.showTimeline}
      </button>

      {/* タイムライングラフ */}
      {showTimeline && (
        <div className="space-y-2">
          {career.yearlyStats.map((yearData) => {
            const barWidth = (yearData.count / maxCount) * 100;
            const isPeakYear = yearData.year === career.peakYear;

            return (
              <div key={yearData.year} className="group">
                <div className="flex items-center gap-3">
                  {/* 年ラベル */}
                  <div className={`w-12 text-sm font-medium ${isPeakYear ? 'text-yellow-400' : 'text-gray-400'}`}>
                    {yearData.year}
                  </div>

                  {/* バー */}
                  <div className="flex-1 h-6 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isPeakYear
                          ? 'bg-gradient-to-r from-yellow-500 to-orange-500'
                          : 'bg-gradient-to-r from-blue-500 to-purple-500'
                      }`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>

                  {/* 作品数 */}
                  <div className={`w-8 text-sm text-right ${isPeakYear ? 'text-yellow-400 font-bold' : 'text-gray-300'}`}>
                    {yearData.count}
                  </div>
                </div>

                {/* 作品リスト（ホバー時に展開してもいいが、クリックで詳細表示） */}
                {isPeakYear && yearData.products.length > 0 && (
                  <div className="ml-16 mt-1 flex flex-wrap gap-1">
                    {yearData.products.slice(0, 3).map((product) => (
                      <Link
                        key={product.id}
                        href={`/${locale}/products/${product.id}`}
                        className="text-xs text-gray-500 hover:text-rose-400 truncate max-w-[150px]"
                      >
                        {product.title}
                      </Link>
                    ))}
                    {yearData.products.length > 3 && (
                      <span className="text-xs text-gray-600">+{yearData.products.length - 3}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
