'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Flame, Clock } from 'lucide-react';
import { localizedHref } from '@adult-v/shared/i18n';

interface CompactSaleStripProps {
  saleCount: number;
  maxDiscount: number;
  nearestEndAt: string | null;
  locale: string;
}

const texts = {
  ja: {
    sale: 'SALE',
    maxOff: (p: number) => `最大${p}%OFF`,
    count: (n: number) => `${n}件セール中`,
    viewAll: 'セールを見る',
    timeLeft: (h: number, m: number) => `残り${h}h${m}m`,
    timeLeftMin: (m: number) => `残り${m}m`,
  },
  en: {
    sale: 'SALE',
    maxOff: (p: number) => `Up to ${p}% OFF`,
    count: (n: number) => `${n} on sale`,
    viewAll: 'View Sales',
    timeLeft: (h: number, m: number) => `${h}h ${m}m left`,
    timeLeftMin: (m: number) => `${m}m left`,
  },
} as const;

function getTexts(locale: string) {
  return texts[locale as keyof typeof texts] || texts.ja;
}

export default function CompactSaleStrip({ saleCount, maxDiscount, nearestEndAt, locale }: CompactSaleStripProps) {
  const t = getTexts(locale);
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number } | null>(null);

  useEffect(() => {
    if (!nearestEndAt) return;
    const calc = () => {
      const end = new Date(nearestEndAt).getTime();
      if (isNaN(end)) return;
      const diff = end - Date.now();
      if (diff <= 0) {
        setTimeLeft(null);
        return;
      }
      setTimeLeft({
        hours: Math.floor(diff / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
      });
    };
    calc();
    const timer = setInterval(calc, 60000);
    return () => clearInterval(timer);
  }, [nearestEndAt]);

  if (saleCount === 0) return null;

  return (
    <Link
      href={localizedHref('/sales', locale)}
      className="flex items-center gap-2 border-b border-white/5 bg-gradient-to-r from-red-950/40 to-transparent px-4 py-2.5 transition-colors hover:from-red-950/60 sm:gap-3"
    >
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gradient-to-r from-red-600 to-orange-500 px-2 py-0.5 text-xs font-bold text-white">
        <Flame className="h-3 w-3" />
        {t.sale}
      </span>
      <span className="text-sm font-semibold text-red-300">{t.maxOff(maxDiscount)}</span>
      <span className="hidden text-xs text-gray-400 sm:inline">{t.count(saleCount)}</span>
      <span className="flex-1" />
      {timeLeft && (
        <span className="flex shrink-0 items-center gap-1 text-xs text-gray-400">
          <Clock className="h-3 w-3" />
          {timeLeft.hours > 0 ? t.timeLeft(timeLeft.hours, timeLeft.minutes) : t.timeLeftMin(timeLeft.minutes)}
        </span>
      )}
      <span className="shrink-0 text-xs font-medium text-fuchsia-400">{t.viewAll} &rarr;</span>
    </Link>
  );
}
