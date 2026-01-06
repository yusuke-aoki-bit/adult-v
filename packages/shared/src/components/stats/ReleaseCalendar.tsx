'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';

interface DailyRelease {
  date: string;
  releaseCount: number;
  products: { id: number; title: string; normalizedProductId: string | null }[];
}

interface Props {
  data: DailyRelease[];
  year: number;
  month: number;
  onMonthChange?: (year: number, month: number) => void;
  locale?: string;
  productLinkPrefix?: string;
  minYear?: number;
  maxYear?: number;
}

const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土'];
const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function ReleaseCalendar({
  data,
  year,
  month,
  onMonthChange,
  locale = 'ja',
  productLinkPrefix = '/products',
  minYear = 2000,
  maxYear = new Date().getFullYear() + 1,
}: Props) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showYearPicker, setShowYearPicker] = useState(false);

  const weekdays = locale === 'ja' ? WEEKDAYS_JA : WEEKDAYS_EN;

  // 年の選択肢を生成（新しい順）
  const years = Array.from(
    { length: maxYear - minYear + 1 },
    (_, i) => maxYear - i
  );

  // 日付ごとのデータマップを作成
  const dateMap = useMemo(() => {
    const map = new Map<string, DailyRelease>();
    data.forEach(d => map.set(d.date, d));
    return map;
  }, [data]);

  // カレンダーの日付配列を生成
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const startPadding = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const days: (number | null)[] = [];

    // 月初の空白
    for (let i = 0; i < startPadding; i++) {
      days.push(null);
    }

    // 日付
    for (let i = 1; i <= totalDays; i++) {
      days.push(i);
    }

    return days;
  }, [year, month]);

  const formatDate = (day: number) => {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const selectedDateData = selectedDate ? dateMap.get(selectedDate) : null;

  const getIntensityClass = (count: number) => {
    if (count === 0) return 'bg-gray-50 dark:bg-gray-800';
    if (count < 10) return 'bg-indigo-100 dark:bg-indigo-900/30';
    if (count < 50) return 'bg-indigo-200 dark:bg-indigo-800/40';
    if (count < 100) return 'bg-indigo-300 dark:bg-indigo-700/50';
    return 'bg-indigo-400 dark:bg-indigo-600/60';
  };

  const handlePrevMonth = () => {
    if (onMonthChange) {
      if (month === 1) {
        if (year > minYear) {
          onMonthChange(year - 1, 12);
        }
      } else {
        onMonthChange(year, month - 1);
      }
    }
  };

  const handleNextMonth = () => {
    if (onMonthChange) {
      // maxYearの12月まで進める
      if (year === maxYear && month >= 12) {
        return;
      }

      if (month === 12) {
        onMonthChange(year + 1, 1);
      } else {
        onMonthChange(year, month + 1);
      }
    }
  };

  const handleYearChange = (newYear: number) => {
    if (onMonthChange) {
      onMonthChange(newYear, month);
    }
    setShowYearPicker(false);
  };

  const handleMonthSelect = (newMonth: number) => {
    if (onMonthChange) {
      onMonthChange(year, newMonth);
    }
    setShowYearPicker(false);
  };

  const canGoNext = () => {
    return !(year === maxYear && month >= 12);
  };

  const canGoPrev = () => {
    return !(year === minYear && month === 1);
  };

  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  return (
    <div className="w-full">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={handlePrevMonth}
          disabled={!canGoPrev()}
          className={`p-2 rounded-lg transition-colors ${
            canGoPrev()
              ? 'hover:bg-gray-100 dark:hover:bg-gray-700'
              : 'opacity-30 cursor-not-allowed'
          }`}
          aria-label="前月"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="relative">
          <button
            onClick={() => setShowYearPicker(!showYearPicker)}
            className="text-lg font-bold hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-1"
          >
            {year}年{month}月
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* 年月選択ドロップダウン */}
          {showYearPicker && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20 p-3 min-w-[280px]">
              {/* 年選択 */}
              <div className="mb-3">
                <p className="text-xs text-gray-500 mb-2">年を選択</p>
                <div className="grid grid-cols-4 gap-1 max-h-32 overflow-y-auto">
                  {years.map((y) => (
                    <button
                      key={y}
                      onClick={() => handleYearChange(y)}
                      className={`px-2 py-1 text-sm rounded transition-colors ${
                        y === year
                          ? 'bg-indigo-500 text-white'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              </div>

              {/* 月選択 */}
              <div>
                <p className="text-xs text-gray-500 mb-2">月を選択</p>
                <div className="grid grid-cols-4 gap-1">
                  {months.map((m) => (
                    <button
                      key={m}
                      onClick={() => handleMonthSelect(m)}
                      className={`px-2 py-1 text-sm rounded transition-colors ${
                        m === month
                          ? 'bg-indigo-500 text-white'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      {m}月
                    </button>
                  ))}
                </div>
              </div>

              {/* 閉じるボタン */}
              <button
                onClick={() => setShowYearPicker(false)}
                className="mt-3 w-full py-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                閉じる
              </button>
            </div>
          )}
        </div>

        <button
          onClick={handleNextMonth}
          disabled={!canGoNext()}
          className={`p-2 rounded-lg transition-colors ${
            canGoNext()
              ? 'hover:bg-gray-100 dark:hover:bg-gray-700'
              : 'opacity-30 cursor-not-allowed'
          }`}
          aria-label="次月"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* 曜日ヘッダー */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {weekdays.map((day, index) => (
          <div
            key={day}
            className={`text-center text-xs font-medium py-2 ${
              index === 0 ? 'text-red-500' : index === 6 ? 'text-blue-500' : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* カレンダーグリッド */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, index) => {
          if (day === null) {
            return <div key={`empty-${index}`} className="aspect-square" />;
          }

          const dateStr = formatDate(day);
          const dateData = dateMap.get(dateStr);
          const releaseCount = dateData?.releaseCount || 0;
          const isSelected = selectedDate === dateStr;
          const dayOfWeek = (index) % 7;

          return (
            <button
              key={dateStr}
              onClick={() => setSelectedDate(isSelected ? null : dateStr)}
              className={`
                aspect-square p-1 rounded-lg text-sm relative transition-all
                ${getIntensityClass(releaseCount)}
                ${isSelected ? 'ring-2 ring-indigo-500' : ''}
                hover:ring-2 hover:ring-indigo-300
              `}
            >
              <span className={`
                absolute top-1 left-2 text-xs
                ${dayOfWeek === 0 ? 'text-red-500' : dayOfWeek === 6 ? 'text-blue-500' : ''}
              `}>
                {day}
              </span>
              {releaseCount > 0 && (
                <span className="absolute bottom-1 right-1 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  {releaseCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 選択日の詳細 */}
      {selectedDateData && (
        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <h4 className="font-bold mb-2">
            {selectedDate} ({selectedDateData.releaseCount}作品)
          </h4>
          <ul className="space-y-1 max-h-48 overflow-y-auto">
            {selectedDateData.products.map(product => (
              <li key={product['id']} className="text-sm">
                <Link
                  href={`${productLinkPrefix}/${product.normalizedProductId || product['id']}`}
                  className="text-indigo-600 dark:text-indigo-400 hover:underline line-clamp-1"
                >
                  {product['title']}
                </Link>
              </li>
            ))}
            {selectedDateData.releaseCount > 10 && (
              <li className="text-xs text-gray-500">
                他 {selectedDateData.releaseCount - 10} 作品...
              </li>
            )}
          </ul>
        </div>
      )}

      {/* 凡例 */}
      <div className="mt-4 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
        <span>少</span>
        <div className="flex gap-1">
          <div className="w-4 h-4 rounded bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700" />
          <div className="w-4 h-4 rounded bg-indigo-100 dark:bg-indigo-900/30" />
          <div className="w-4 h-4 rounded bg-indigo-200 dark:bg-indigo-800/40" />
          <div className="w-4 h-4 rounded bg-indigo-300 dark:bg-indigo-700/50" />
          <div className="w-4 h-4 rounded bg-indigo-400 dark:bg-indigo-600/60" />
        </div>
        <span>多</span>
      </div>
    </div>
  );
}
