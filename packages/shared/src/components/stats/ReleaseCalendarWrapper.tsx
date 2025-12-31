'use client';

import { useState, useEffect } from 'react';
import ReleaseCalendar from './ReleaseCalendar';

interface DailyRelease {
  date: string;
  releaseCount: number;
  products: { id: number; title: string; normalizedProductId: string | null }[];
}

interface Props {
  initialData: DailyRelease[];
  initialYear: number;
  initialMonth: number;
  locale?: string;
  productLinkPrefix?: string;
  fetchUrl?: string;
}

export default function ReleaseCalendarWrapper({
  initialData,
  initialYear,
  initialMonth,
  locale = 'ja',
  productLinkPrefix = '/products',
  fetchUrl = '/api/stats/daily-releases',
}: Props) {
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [data, setData] = useState<DailyRelease[]>(initialData);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 初期データと同じ月なら再取得不要
    if (year === initialYear && month === initialMonth) {
      setData(initialData);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${fetchUrl}?year=${year}&month=${month}`);
        if (res.ok) {
          const json = await res.json();
          setData(json.data || []);
        }
      } catch (error) {
        console.error('Failed to fetch calendar data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [year, month, initialYear, initialMonth, initialData, fetchUrl]);

  const handleMonthChange = (newYear: number, newMonth: number) => {
    setYear(newYear);
    setMonth(newMonth);
  };

  return (
    <div className="relative">
      {loading && (
        <div className="absolute inset-0 bg-white/50 dark:bg-gray-900/50 flex items-center justify-center z-10 rounded-lg">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      <ReleaseCalendar
        data={data}
        year={year}
        month={month}
        onMonthChange={handleMonthChange}
        locale={locale}
        productLinkPrefix={productLinkPrefix}
      />
    </div>
  );
}
