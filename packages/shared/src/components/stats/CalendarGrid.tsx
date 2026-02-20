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

  const weekdays = WEEKDAYS_MAP[locale] || WEEKDAYS_MAP['en'];

  // 現在のフィルターパラメータを保持して商品リンクに追加
  const buildProductLink = useCallback((dateStr: string) => {
    const params = new URLSearchParams();
    params.set('releaseDate', dateStr);

    // フィルターパラメータを保持（year, monthは除外）
    const filterKeys = ['includeAsp', 'excludeAsp', 'hasVideo', 'hasImage', 'onSale', 'include', 'exclude', 'performerType', 'hl'];
    filterKeys.forEach(key => {
      const value = searchParams.get(key);
      if (value) {
        params.set(key, value);
      }
    });

    return `${productLinkPrefix}?${params.toString()}`;
  }, [productLinkPrefix, searchParams]);

  const handleProductClick = useCallback((product: CalendarProduct) => {
    setLightboxProduct(product);
    setLightboxOpen(true);
  }, []);

  const handleLightboxClose = useCallback(() => {
    setLightboxOpen(false);
    setLightboxProduct(null);
  }, []);

  const years = Array.from(
    { length: maxYear - minYear + 1 },
    (_, i) => maxYear - i
  );

  const dateMap = useMemo(() => {
    const map = new Map<string, CalendarDayData>();
    data.forEach(d => map.set(d.date, d));
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
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={handlePrevMonth}
          disabled={!canGoPrev()}
          className={`p-3 rounded-lg transition-colors ${
            canGoPrev()
              ? 'hover:bg-gray-100 dark:hover:bg-gray-700'
              : 'opacity-30 cursor-not-allowed'
          }`}
          aria-label="前月"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="relative">
          <button
            onClick={() => setShowYearPicker(!showYearPicker)}
            className="text-2xl font-bold hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-2"
          >
            {year}年{month}月
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showYearPicker && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20 p-4 min-w-[300px]">
              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-2">年を選択</p>
                <div className="grid grid-cols-4 gap-1 max-h-32 overflow-y-auto">
                  {years.map((y) => (
                    <button
                      key={y}
                      onClick={() => handleYearChange(y)}
                      className={`px-2 py-1 text-sm rounded transition-colors ${
                        y === year ? 'bg-indigo-500 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-2">月を選択</p>
                <div className="grid grid-cols-4 gap-1">
                  {months.map((m) => (
                    <button
                      key={m}
                      onClick={() => handleMonthSelect(m)}
                      className={`px-2 py-1 text-sm rounded transition-colors ${
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
          className={`p-3 rounded-lg transition-colors ${
            canGoNext()
              ? 'hover:bg-gray-100 dark:hover:bg-gray-700'
              : 'opacity-30 cursor-not-allowed'
          }`}
          aria-label="次月"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* 曜日ヘッダー */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {weekdays.map((day, index) => (
          <div
            key={day}
            className={`text-center text-sm font-medium py-2 ${
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
              className="min-h-[180px] bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-2 hover:shadow-md transition-shadow"
            >
              {/* 日付ヘッダー */}
              <div className="flex items-center justify-between mb-2">
                {dateData && dateData.releaseCount > 0 ? (
                  <Link
                    href={buildProductLink(dateStr)}
                    className={`text-lg font-bold hover:underline ${
                      dayOfWeek === 0 ? 'text-red-500' : dayOfWeek === 6 ? 'text-blue-500' : 'text-indigo-600 dark:text-indigo-400'
                    }`}
                  >
                    {day}
                  </Link>
                ) : (
                  <span className={`text-lg font-bold ${
                    dayOfWeek === 0 ? 'text-red-500' : dayOfWeek === 6 ? 'text-blue-500' : ''
                  }`}>
                    {day}
                  </span>
                )}
                {dateData && dateData.releaseCount > 0 && (
                  <Link
                    href={buildProductLink(dateStr)}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
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
                          className="block relative rounded overflow-hidden hover:ring-2 hover:ring-indigo-400 transition-all cursor-pointer"
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
                    <div className="flex gap-1 flex-wrap">
                      {dateData.performers.slice(0, 2).map((performer) => (
                        <Link
                          key={performer['id']}
                          href={`${actressLinkPrefix}/${performer['id']}`}
                          className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full text-[10px] hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
                          title={performer['name']}
                        >
                          {performer.imageUrl && normalizeImageUrl(performer.imageUrl) !== PLACEHOLDER_URL && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={normalizeImageUrl(performer.imageUrl)}
                              alt={performer['name']}
                              width={16}
                              height={16}
                              className="rounded-full object-cover w-4 h-4"
                            />
                          )}
                          <span className="truncate max-w-[50px]">{performer['name']}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-300 dark:text-gray-600 text-xs">
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
