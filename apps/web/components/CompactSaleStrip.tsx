'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Flame, Clock } from 'lucide-react';
import { localizedHref } from '@adult-v/shared/i18n';
import { normalizeImageUrl } from '@adult-v/shared/lib/image-utils';

interface DealProduct {
  productId: number;
  title: string;
  thumbnailUrl: string | null;
  affiliateUrl: string | null;
  salePrice: number;
  discountPercent: number;
  aspName: string;
}

interface CompactSaleStripProps {
  saleCount: number;
  maxDiscount: number;
  nearestEndAt: string | null;
  locale: string;
  /** Top sale products for inline deal links */
  topProducts?: DealProduct[];
}

const texts = {
  ja: {
    sale: 'SALE',
    maxOff: (p: number) => `最大${p}%OFF`,
    count: (n: number) => `${n}件セール中`,
    viewAll: '全セール',
    timeLeft: (h: number, m: number) => `残り${h}h${m}m`,
    timeLeftMin: (m: number) => `残り${m}m`,
    buy: '購入',
  },
  en: {
    sale: 'SALE',
    maxOff: (p: number) => `Up to ${p}% OFF`,
    count: (n: number) => `${n} on sale`,
    viewAll: 'All Sales',
    timeLeft: (h: number, m: number) => `${h}h ${m}m left`,
    timeLeftMin: (m: number) => `${m}m left`,
    buy: 'Buy',
  },
} as const;

function getTexts(locale: string) {
  return texts[locale as keyof typeof texts] || texts.ja;
}

export default function CompactSaleStrip({
  saleCount,
  maxDiscount,
  nearestEndAt,
  locale,
  topProducts,
}: CompactSaleStripProps) {
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

  const deals = topProducts?.filter((p) => p.affiliateUrl).slice(0, 4) || [];

  return (
    <div className="border-b border-white/5 bg-linear-to-r from-red-950/40 to-transparent">
      {/* Row 1: Sale info banner */}
      <Link
        href={localizedHref('/sales', locale)}
        aria-label={`${t.sale} ${t.maxOff(maxDiscount)} - ${t.count(saleCount)}`}
        className="flex items-center gap-2 px-4 py-2 transition-colors hover:from-red-950/60 sm:gap-3"
      >
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-linear-to-r from-red-600 to-orange-500 px-2 py-0.5 text-xs font-bold text-white">
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

      {/* Row 2: Inline deal products with direct affiliate links */}
      {deals.length > 0 && (
        <div className="hide-scrollbar flex gap-2 overflow-x-auto px-4 pb-2.5">
          {deals.map((p) => {
            const src = normalizeImageUrl(p.thumbnailUrl);
            // FANZA compliance: skip FANZA products on adult-v
            const isFanza = p.aspName?.toLowerCase() === 'fanza';
            if (isFanza) return null;
            return (
              <a
                key={p.productId}
                href={p.affiliateUrl!}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="flex shrink-0 items-center gap-2 rounded-lg bg-white/5 px-2 py-1.5 ring-1 ring-white/5 transition-all hover:bg-white/10 hover:ring-red-500/30"
              >
                {src && (
                  <div className="relative h-9 w-7 shrink-0 overflow-hidden rounded">
                    <Image src={src} alt={p.title} fill className="object-cover" sizes="28px" quality={40} />
                  </div>
                )}
                <span className="rounded-md bg-linear-to-r from-red-600 to-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  -{p.discountPercent}%
                </span>
                <span className="text-[11px] font-bold text-white">¥{p.salePrice.toLocaleString()}</span>
                <span className="text-[10px] font-semibold text-orange-300">{t.buy} &rarr;</span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
