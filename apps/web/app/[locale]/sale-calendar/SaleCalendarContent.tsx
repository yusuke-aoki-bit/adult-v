'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { HomeSectionManager } from '@adult-v/shared/components';

interface SaleEvent {
  date: string;
  productCount: number;
  avgDiscount: number;
}

interface MonthStats {
  month: number;
  avgSaleProducts: number;
  avgDiscount: number;
  saleFrequency: number;
}

interface PredictedSale {
  month: number;
  day: number;
  frequency: number;
}

interface CalendarData {
  year: number;
  saleEvents: SaleEvent[];
  monthStats: MonthStats[];
  predictedSales: PredictedSale[];
  nextBigSale: PredictedSale | null;
  summary: {
    totalSaleDays: number;
    avgMonthlyDiscount: number;
    peakMonth: number | null;
  };
}

const TRANSLATIONS = {
  ja: {
    title: 'セールカレンダー',
    subtitle: '年間セールスケジュールと傾向分析',
    monthNames: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    dayNames: ['日', '月', '火', '水', '木', '金', '土'],
    summary: {
      totalSaleDays: '年間セール日数',
      avgDiscount: '平均割引率',
      peakMonth: 'ピーク月',
      days: '日',
    },
    monthStats: {
      title: '月別傾向',
      saleDays: 'セール日数',
      avgDiscount: '平均割引',
      products: '商品数/日',
    },
    predicted: {
      title: '次の大型セール予測',
      basedOn: '過去のデータに基づく予測',
      around: '頃',
    },
    legend: {
      title: '凡例',
      noSale: 'セールなし',
      lowSale: '小規模セール',
      mediumSale: '中規模セール',
      bigSale: '大型セール',
    },
    loading: '読み込み中...',
    noData: 'データがありません',
    backToHome: 'ホームに戻る',
  },
  en: {
    title: 'Sale Calendar',
    subtitle: 'Annual sale schedule and trend analysis',
    monthNames: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    dayNames: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    summary: {
      totalSaleDays: 'Total sale days',
      avgDiscount: 'Avg. discount',
      peakMonth: 'Peak month',
      days: 'days',
    },
    monthStats: {
      title: 'Monthly Trends',
      saleDays: 'Sale days',
      avgDiscount: 'Avg. discount',
      products: 'Products/day',
    },
    predicted: {
      title: 'Next Big Sale Prediction',
      basedOn: 'Based on historical data',
      around: '',
    },
    legend: {
      title: 'Legend',
      noSale: 'No sale',
      lowSale: 'Small sale',
      mediumSale: 'Medium sale',
      bigSale: 'Big sale',
    },
    loading: 'Loading...',
    noData: 'No data available',
    backToHome: 'Back to Home',
  },
  zh: {
    title: '促销日历',
    subtitle: '年度促销时间表和趋势分析',
    monthNames: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    dayNames: ['日', '一', '二', '三', '四', '五', '六'],
    summary: {
      totalSaleDays: '年度促销天数',
      avgDiscount: '平均折扣',
      peakMonth: '高峰月',
      days: '天',
    },
    monthStats: {
      title: '月度趋势',
      saleDays: '促销天数',
      avgDiscount: '平均折扣',
      products: '商品数/天',
    },
    predicted: {
      title: '下次大促预测',
      basedOn: '基于历史数据预测',
      around: '左右',
    },
    legend: {
      title: '图例',
      noSale: '无促销',
      lowSale: '小型促销',
      mediumSale: '中型促销',
      bigSale: '大型促销',
    },
    loading: '加载中...',
    noData: '暂无数据',
    backToHome: '返回首页',
  },
  'zh-TW': {
    title: '促銷日曆',
    subtitle: '年度促銷時間表和趨勢分析',
    monthNames: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    dayNames: ['日', '一', '二', '三', '四', '五', '六'],
    summary: {
      totalSaleDays: '年度促銷天數',
      avgDiscount: '平均折扣',
      peakMonth: '高峰月',
      days: '天',
    },
    monthStats: {
      title: '月度趨勢',
      saleDays: '促銷天數',
      avgDiscount: '平均折扣',
      products: '商品數/天',
    },
    predicted: {
      title: '下次大促預測',
      basedOn: '基於歷史資料預測',
      around: '左右',
    },
    legend: {
      title: '圖例',
      noSale: '無促銷',
      lowSale: '小型促銷',
      mediumSale: '中型促銷',
      bigSale: '大型促銷',
    },
    loading: '載入中...',
    noData: '暫無資料',
    backToHome: '返回首頁',
  },
  ko: {
    title: '세일 캘린더',
    subtitle: '연간 세일 일정 및 트렌드 분석',
    monthNames: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
    dayNames: ['일', '월', '화', '수', '목', '금', '토'],
    summary: {
      totalSaleDays: '연간 세일 일수',
      avgDiscount: '평균 할인율',
      peakMonth: '피크 월',
      days: '일',
    },
    monthStats: {
      title: '월별 트렌드',
      saleDays: '세일 일수',
      avgDiscount: '평균 할인',
      products: '상품수/일',
    },
    predicted: {
      title: '다음 대형 세일 예측',
      basedOn: '과거 데이터 기반 예측',
      around: '경',
    },
    legend: {
      title: '범례',
      noSale: '세일 없음',
      lowSale: '소규모 세일',
      mediumSale: '중규모 세일',
      bigSale: '대형 세일',
    },
    loading: '로딩 중...',
    noData: '데이터 없음',
    backToHome: '홈으로 돌아가기',
  },
};

interface SaleCalendarContentProps {
  locale: string;
}

export default function SaleCalendarContent({ locale }: SaleCalendarContentProps) {
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [_selectedMonth, _setSelectedMonth] = useState(new Date().getMonth());

  const t = TRANSLATIONS[locale as keyof typeof TRANSLATIONS] || TRANSLATIONS.ja;

  useEffect(() => {
    async function fetchCalendarData() {
      try {
        const response = await fetch(`/api/sale-calendar?year=${selectedYear}`);
        if (response.ok) {
          const result = await response.json();
          setData(result);
        }
      } catch (error) {
        console.error('Failed to fetch calendar data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchCalendarData();
  }, [selectedYear]);

  const getSaleIntensity = (date: string): 'none' | 'low' | 'medium' | 'high' => {
    if (!data) return 'none';
    const event = data.saleEvents.find((e) => e.date === date);
    if (!event) return 'none';
    if (event.productCount >= 100) return 'high';
    if (event.productCount >= 30) return 'medium';
    return 'low';
  };

  const getIntensityColor = (intensity: 'none' | 'low' | 'medium' | 'high') => {
    switch (intensity) {
      case 'high':
        return 'bg-red-500';
      case 'medium':
        return 'bg-orange-500';
      case 'low':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-700';
    }
  };

  const renderCalendarMonth = (monthIndex: number) => {
    const year = selectedYear;
    const firstDay = new Date(year, monthIndex, 1).getDay();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const days = [];

    // 空白セル
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-8" />);
    }

    // 日付セル
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const intensity = getSaleIntensity(dateStr);
      const isToday = new Date().toISOString().split('T')[0] === dateStr;

      days.push(
        <div
          key={day}
          className={`flex h-8 w-8 items-center justify-center rounded text-xs ${getIntensityColor(intensity)} ${
            isToday ? 'ring-2 ring-white' : ''
          } ${intensity !== 'none' ? 'font-medium text-white' : 'text-gray-400'}`}
          title={intensity !== 'none' ? `${dateStr}: セール` : undefined}
        >
          {day}
        </div>,
      );
    }

    return (
      <div className="rounded-lg bg-gray-800 p-4">
        <h3 className="mb-3 text-center font-bold text-white">{t.monthNames[monthIndex]}</h3>
        <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs text-gray-500">
          {t.dayNames.map((day) => (
            <div key={day}>{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">{days}</div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 p-6">
        <div className="mx-auto max-w-7xl">
          <div className="mb-4 h-8 w-48 animate-pulse rounded bg-gray-700" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-64 animate-pulse rounded-lg bg-gray-800" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <Link
            href={`/${locale}`}
            className="mb-4 inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t.backToHome}
          </Link>
          <h1 className="flex items-center gap-3 text-3xl font-bold text-white">
            <svg className="h-8 w-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            {t.title}
          </h1>
          <p className="mt-2 text-gray-400">{t.subtitle}</p>
        </div>

        {/* Year Selector */}
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => setSelectedYear((y) => y - 1)}
            className="rounded-lg bg-gray-800 p-2 text-white hover:bg-gray-700"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-2xl font-bold text-white">{selectedYear}</span>
          <button
            onClick={() => setSelectedYear((y) => y + 1)}
            className="rounded-lg bg-gray-800 p-2 text-white hover:bg-gray-700"
            disabled={selectedYear >= new Date().getFullYear()}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Summary Cards */}
        {data && data.summary && (
          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-blue-700/30 bg-linear-to-br from-blue-900/50 to-blue-800/30 p-6">
              <p className="text-sm text-blue-400">{t.summary.totalSaleDays}</p>
              <p className="mt-1 text-3xl font-bold text-white">
                {data.summary.totalSaleDays}
                <span className="ml-1 text-lg text-gray-400">{t.summary.days}</span>
              </p>
            </div>
            <div className="rounded-lg border border-green-700/30 bg-linear-to-br from-green-900/50 to-green-800/30 p-6">
              <p className="text-sm text-green-400">{t.summary.avgDiscount}</p>
              <p className="mt-1 text-3xl font-bold text-white">{data.summary.avgMonthlyDiscount}%</p>
            </div>
            <div className="rounded-lg border border-purple-700/30 bg-linear-to-br from-purple-900/50 to-purple-800/30 p-6">
              <p className="text-sm text-purple-400">{t.summary.peakMonth}</p>
              <p className="mt-1 text-3xl font-bold text-white">
                {data.summary.peakMonth ? t.monthNames[data.summary.peakMonth - 1] : '-'}
              </p>
            </div>
          </div>
        )}

        {/* Next Big Sale Prediction */}
        {data?.nextBigSale && (
          <div className="mb-8 rounded-lg border border-yellow-700/30 bg-linear-to-r from-yellow-900/30 to-orange-900/30 p-6">
            <h2 className="mb-2 flex items-center gap-2 text-xl font-bold text-yellow-400">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {t.predicted.title}
            </h2>
            <p className="mb-3 text-sm text-gray-400">{t.predicted.basedOn}</p>
            <p className="text-2xl font-bold text-white">
              {t.monthNames[data.nextBigSale.month - 1]} {data.nextBigSale.day}日{t.predicted.around}
            </p>
          </div>
        )}

        {/* Legend */}
        <div className="mb-6 rounded-lg bg-gray-800 p-4">
          <h3 className="mb-3 text-sm font-medium text-gray-400">{t.legend.title}</h3>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-gray-700" />
              <span className="text-sm text-gray-400">{t.legend.noSale}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-yellow-500" />
              <span className="text-sm text-gray-400">{t.legend.lowSale}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-orange-500" />
              <span className="text-sm text-gray-400">{t.legend.mediumSale}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-red-500" />
              <span className="text-sm text-gray-400">{t.legend.bigSale}</span>
            </div>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i}>{renderCalendarMonth(i)}</div>
          ))}
        </div>

        {/* Monthly Stats */}
        {data && data.monthStats.length > 0 && (
          <div className="rounded-lg bg-gray-800 p-6">
            <h2 className="mb-4 text-xl font-bold text-white">{t.monthStats.title}</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 text-gray-400">
                    <th className="px-4 py-3 text-left">{locale === 'en' ? 'Month' : '月'}</th>
                    <th className="px-4 py-3 text-right">{t.monthStats.saleDays}</th>
                    <th className="px-4 py-3 text-right">{t.monthStats.avgDiscount}</th>
                    <th className="px-4 py-3 text-right">{t.monthStats.products}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.monthStats.map((stat) => (
                    <tr key={stat.month} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                      <td className="px-4 py-3 font-medium text-white">{t.monthNames[stat.month - 1]}</td>
                      <td className="px-4 py-3 text-right text-gray-300">
                        {stat.saleFrequency}
                        {t.summary.days}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`${
                            stat.avgDiscount >= 40
                              ? 'text-red-400'
                              : stat.avgDiscount >= 25
                                ? 'text-orange-400'
                                : 'text-yellow-400'
                          }`}
                        >
                          {stat.avgDiscount}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300">{stat.avgSaleProducts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* セクションカスタマイズ */}
        <div className="mt-8">
          <HomeSectionManager locale={locale} theme="dark" pageId="sale-calendar" />
        </div>
      </div>
    </div>
  );
}
