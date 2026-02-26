'use client';

import Link from 'next/link';
import Image from 'next/image';
import { TrendingUp } from 'lucide-react';
import { localizedHref } from '@adult-v/shared/i18n';
import { normalizeImageUrl } from '@adult-v/shared/lib/image-utils';

interface TrendingActress {
  id: number;
  name: string;
  thumbnailUrl: string | null;
  releaseCount?: number;
}

interface CompactTrendingStripProps {
  trendingActresses: TrendingActress[];
  locale: string;
}

const texts = {
  ja: { trending: 'トレンド', seeMore: 'もっと見る' },
  en: { trending: 'Trending', seeMore: 'See more' },
} as const;

function getTexts(locale: string) {
  return texts[locale as keyof typeof texts] || texts.ja;
}

export default function CompactTrendingStrip({ trendingActresses, locale }: CompactTrendingStripProps) {
  if (trendingActresses.length === 0) return null;

  const t = getTexts(locale);

  return (
    <div className="flex items-center gap-3 border-b border-white/5 bg-linear-to-r from-green-950/20 to-transparent px-4 py-2.5">
      <div className="flex shrink-0 items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-green-600/20 px-2 py-0.5 text-green-400 ring-1 ring-green-500/20">
          <TrendingUp className="h-3 w-3" />
          <span className="text-[11px] font-bold">{t.trending}</span>
        </span>
      </div>
      <div className="hide-scrollbar flex flex-1 items-center gap-3 overflow-x-auto">
        {trendingActresses.map((actress, idx) => (
          <Link
            key={actress.id}
            href={localizedHref(`/actress/${actress.id}`, locale)}
            className="group flex shrink-0 flex-col items-center"
          >
            <div
              className={`relative h-10 w-10 overflow-hidden rounded-full transition-all sm:h-12 sm:w-12 ${
                idx < 3
                  ? 'ring-2 ring-fuchsia-500/40 group-hover:ring-fuchsia-400'
                  : 'ring-2 ring-transparent group-hover:ring-fuchsia-500/60'
              }`}
            >
              {actress.thumbnailUrl ? (
                <Image
                  src={normalizeImageUrl(actress.thumbnailUrl)}
                  alt={actress.name}
                  fill
                  className="object-cover"
                  sizes="48px"
                  quality={60}
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gray-700 text-xs text-gray-400">
                  {actress.name[0]}
                </div>
              )}
            </div>
            <span className="mt-1 max-w-12 truncate text-center text-[11px] text-gray-300 transition-colors group-hover:text-fuchsia-400 sm:max-w-14">
              {actress.name}
            </span>
          </Link>
        ))}
      </div>
      <Link
        href={`${localizedHref('/', locale)}?sort=productCountDesc`}
        className="shrink-0 text-[11px] font-medium text-fuchsia-400 transition-colors hover:text-fuchsia-300 sm:text-xs"
      >
        {t.seeMore} &rarr;
      </Link>
    </div>
  );
}
