'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import ImageLightbox from '../ImageLightbox';
import { normalizeImageUrl } from '../../lib/image-utils';

const PLACEHOLDER_URL = 'https://placehold.co/400x520/052e16/ffffff?text=No+Image';

interface CalendarProduct {
  id: number;
  title: string;
  normalizedProductId: string | null;
  thumbnailUrl: string | null;
  releaseDate: string;
}

interface CalendarPerformer {
  id: number;
  name: string;
  nameReading: string | null;
  imageUrl: string | null;
  productCount: number;
}

interface CalendarDayData {
  date: string;
  releaseCount: number;
  products: CalendarProduct[];
  performers: CalendarPerformer[];
}

interface Props {
  data: CalendarDayData[];
  year: number;
  month: number;
  onMonthChange?: (year: number, month: number) => void;
  locale?: string;
  productLinkPrefix?: string;
  actressLinkPrefix?: string;
  minYear?: number;
  maxYear?: number;
}

const WEEKDAYS_MAP: Record<string, string[]> = {
  ja: ['日', '月', '火', '水', '木', '金', '土'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  zh: ['日', '一', '二', '三', '四', '五', '六'],
  ko: ['일', '월', '화', '수', '목', '금', '토'],
};

export default function CalendarGrid({
  data,
  year,
  month,
  onMonthChange,
  locale = 'ja',
  productLinkPrefix = '/products',
  actressLinkPrefix = '/actresses',
  minYear = 2000,
  maxYear = new Date().getFullYear() + 1,
}: Props) {
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxProduct, setLightboxProduct] = useState<CalendarProduct | null>(null);
  const searchParams = useSearchParams();

  const weekdays = WEEKDAYS_MAP[locale] ?? WEEKDAYS_MAP['en']!;

  // 現在のフィルターパラメータを保持して商品リンクに追加
  const buildProductLink = useCallback(
    (dateStr: string) => {
      const params = new URLSearchParams();
      params.set('releaseDate', dateStr);

      // フィルターパラメータを保持（year, monthは除外）
      const filterKeys = [
        'includeAsp',
        'excludeAsp',
        'hasVideo',
        'hasImage',
        'onSale',
        'include',
        'exclude',
        'performerType',
        'hl',
      ];
      filterKeys.forEach((key) => {
        const value = searchParams.get(key);
        if (value) {
          params.set(key, value);
        }
      });

      return `${productLinkPrefix}?${params.toString()}`;
    },
    [productLinkPrefix, searchParams],
  );

  const handleProductClick = useCallback((product: CalendarProduct) => {
    setLightboxProduct(product);
    setLightboxOpen(true);
  }, []);

  const handleLightboxClose = useCallback(() => {
    setLightboxOpen(false);
    setLightboxProduct(null);
  }, []);

  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => maxYear - i);

  const dateMap = useMemo(() => {
    const map = new Map<string, CalendarDayData>();
    data.forEach((d) => map.set(d.date, d));
    return map;
  }, [data]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const startPadding = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const days: (number | null)[] = [];
    for (let i = 0; i < startPadding; i++) {
      days.push(null);
    }
    for (let i = 1; i <= totalDays; i++) {
      days.push(i);
    }
    return days;
  }, [year, month]);

  const formatDate = (day: number) => {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const handlePrevMonth = () => {
    if (onMonthChange) {
      if (month === 1) {
        if (year > minYear) onMonthChange(year - 1, 12);
      } else {
        onMonthChange(year, month - 1);
      }
    }
  };

  const handleNextMonth = () => {
    if (onMonthChange) {
      if (year === maxYear && month >= 12) return;
      if (month === 12) {
        onMonthChange(year + 1, 1);
      } else {
        onMonthChange(year, month + 1);
      }
    }
  };

  const handleYearChange = (newYear: number) => {
    if (onMonthChange) onMonthChange(newYear, month);
    setShowYearPicker(false);
  };

  const handleMonthSelect = (newMonth: number) => {
    if (onMonthChange) onMonthChange(year, newMonth);
    setShowYearPicker(false);
  };

  const canGoNext = () => !(year === maxYear && month >= 12);
  const canGoPrev = () => !(year === minYear && month === 1);

  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  return (
    <div className="w-full">
      {/* ヘッダー */}
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={handlePrevMonth}
          disabled={!canGoPrev()}
          className={`rounded-lg p-3 transition-colors ${
            canGoPrev() ? 'hover:bg-gray-100 dark:hover:bg-gray-700' : 'cursor-not-allowed opacity-30'
          }`}
          aria-label="前月"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="relative">
          <button
            onClick={() => setShowYearPicker(!showYearPicker)}
            className="flex items-center gap-2 text-2xl font-bold transition-colors hover:text-indigo-600 dark:hover:text-indigo-400"
          >
            {year}年{month}月
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showYearPicker && (
            <div className="absolute top-full left-1/2 z-20 mt-2 min-w-[300px] -translate-x-1/2 rounded-lg border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800">
              <div className="mb-4">
                <p className="mb-2 text-xs text-gray-500">年を選択</p>
                <div className="grid max-h-32 grid-cols-4 gap-1 overflow-y-auto">
                  {years.map((y) => (
                    <button
                      key={y}
                      onClick={() => handleYearChange(y)}
                      className={`rounded px-2 py-1 text-sm transition-colors ${
                        y === year ? 'bg-indigo-500 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs text-gray-500">月を選択</p>
                <div className="grid grid-cols-4 gap-1">
                  {months.map((m) => (
                    <button
                      key={m}
                      onClick={() => handleMonthSelect(m)}
                      className={`rounded px-2 py-1 text-sm transition-colors ${
                        m === month ? 'bg-indigo-500 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      {m}月
                    </button>
                  ))}
                </div>
              </div>
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
          className={`rounded-lg p-3 transition-colors ${
            canGoNext() ? 'hover:bg-gray-100 dark:hover:bg-gray-700' : 'cursor-not-allowed opacity-30'
          }`}
          aria-label="次月"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* 曜日ヘッダー */}
      <div className="mb-2 grid grid-cols-7 gap-2">
        {weekdays.map((day, index) => (
          <div
            key={day}
            className={`py-2 text-center text-sm font-medium ${
              index === 0 ? 'text-red-500' : index === 6 ? 'text-blue-500' : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* カレンダーグリッド */}
      <div className="grid grid-cols-7 gap-2">
        {calendarDays.map((day, index) => {
          if (day === null) {
            return <div key={`empty-${index}`} className="min-h-[180px]" />;
          }

          const dateStr = formatDate(day);
          const dateData = dateMap.get(dateStr);
          const dayOfWeek = index % 7;

          return (
            <div
              key={dateStr}
              className="min-h-[180px] rounded-lg border border-gray-200 bg-white p-2 transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
            >
              {/* 日付ヘッダー */}
              <div className="mb-2 flex items-center justify-between">
                {dateData && dateData.releaseCount > 0 ? (
                  <Link
                    href={buildProductLink(dateStr)}
                    className={`text-lg font-bold hover:underline ${
                      dayOfWeek === 0
                        ? 'text-red-500'
                        : dayOfWeek === 6
                          ? 'text-blue-500'
                          : 'text-indigo-600 dark:text-indigo-400'
                    }`}
                  >
                    {day}
                  </Link>
                ) : (
                  <span
                    className={`text-lg font-bold ${
                      dayOfWeek === 0 ? 'text-red-500' : dayOfWeek === 6 ? 'text-blue-500' : ''
                    }`}
                  >
                    {day}
                  </span>
                )}
                {dateData && dateData.releaseCount > 0 && (
                  <Link
                    href={buildProductLink(dateStr)}
                    className="text-xs text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    {dateData.releaseCount}作品
                  </Link>
                )}
              </div>

              {/* コンテンツ */}
              {dateData && (dateData.products.length > 0 || dateData.performers.length > 0) ? (
                <div className="space-y-2">
                  {/* 商品サムネイル */}
                  {dateData.products.length > 0 && (
                    <div className="grid grid-cols-2 gap-1">
                      {dateData.products.slice(0, 4).map((product) => (
                        <button
                          key={product['id']}
                          type="button"
                          onClick={() => handleProductClick(product)}
                          className="relative block cursor-pointer overflow-hidden rounded transition-all hover:ring-2 hover:ring-indigo-400"
                          style={{ aspectRatio: '3/4' }}
                          title={product['title']}
                        >
                          <Image
                            src={normalizeImageUrl(product['thumbnailUrl'])}
                            alt={product['title']}
                            fill
                            sizes="80px"
                            className="object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* 女優アイコン */}
                  {dateData.performers.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {dateData.performers.slice(0, 2).map((performer) => (
                        <Link
                          key={performer['id']}
                          href={`${actressLinkPrefix}/${performer['id']}`}
                          className="flex items-center gap-1 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] transition-colors hover:bg-indigo-100 dark:bg-gray-700 dark:hover:bg-indigo-900/30"
                          title={performer['name']}
                        >
                          {performer.imageUrl && normalizeImageUrl(performer.imageUrl) !== PLACEHOLDER_URL && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={normalizeImageUrl(performer.imageUrl)}
                              alt={performer['name']}
                              width={16}
                              height={16}
                              className="h-4 w-4 rounded-full object-cover"
                            />
                          )}
                          <span className="max-w-[50px] truncate">{performer['name']}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-gray-300 dark:text-gray-600">
                  -
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 商品プレビューモーダル */}
      {lightboxProduct && lightboxProduct.thumbnailUrl && (
        <ImageLightbox
          images={[lightboxProduct.thumbnailUrl!]}
          isOpen={lightboxOpen}
          onClose={handleLightboxClose}
          alt={lightboxProduct.title}
          detailsUrl={`${productLinkPrefix}/${lightboxProduct.normalizedProductId || lightboxProduct.id}`}
        />
      )}
    </div>
  );
}
