'use client';

import { useState, useCallback, useTransition } from 'react';
import CalendarGrid from './CalendarGrid';

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
  initialData: CalendarDayData[];
  initialYear: number;
  initialMonth: number;
  locale?: string;
  productLinkPrefix?: string;
  actressLinkPrefix?: string;
}

export default function CalendarGridWrapper({
  initialData,
  initialYear,
  initialMonth,
  locale = 'ja',
  productLinkPrefix = '/products',
  actressLinkPrefix = '/actresses',
}: Props) {
  const [data, setData] = useState<CalendarDayData[]>(initialData);
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(false);

  const handleMonthChange = useCallback(async (newYear: number, newMonth: number) => {
    setIsLoading(true);
    setYear(newYear);
    setMonth(newMonth);

    try {
      const response = await fetch(`/api/stats/calendar-detail?year=${newYear}&month=${newMonth}`);
      if (response.ok) {
        const newData = await response.json();
        startTransition(() => {
          setData(newData);
        });
      }
    } catch (error) {
      console.error('Failed to fetch calendar data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <div className={`relative ${isLoading || isPending ? 'opacity-60' : ''}`}>
      {(isLoading || isPending) && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
        </div>
      )}
      <CalendarGrid
        data={data}
        year={year}
        month={month}
        onMonthChange={handleMonthChange}
        locale={locale}
        productLinkPrefix={productLinkPrefix}
        actressLinkPrefix={actressLinkPrefix}
      />
    </div>
  );
}
