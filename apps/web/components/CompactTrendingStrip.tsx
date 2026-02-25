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
    <div className="flex items-center gap-3 border-b border-white/5 px-4 py-2">
      <div className="flex shrink-0 items-center gap-1 text-green-400">
        <TrendingUp className="h-4 w-4" />
        <span className="text-xs font-bold">{t.trending}</span>
      </div>
      <div className="hide-scrollbar flex flex-1 items-center gap-3 overflow-x-auto">
        {trendingActresses.map((actress) => (
          <Link
            key={actress.id}
            href={localizedHref(`/actress/${actress.id}`, locale)}
            className="group flex shrink-0 flex-col items-center"
          >
            <div className="relative h-10 w-10 overflow-hidden rounded-full ring-2 ring-transparent transition-all group-hover:ring-fuchsia-500 sm:h-12 sm:w-12">
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
            <span className="mt-1 max-w-12 truncate text-center text-[10px] text-gray-300 transition-colors group-hover:text-fuchsia-400 sm:max-w-14">
              {actress.name}
            </span>
          </Link>
        ))}
      </div>
      <Link
        href={`${localizedHref('/', locale)}?sort=productCountDesc`}
        className="shrink-0 text-[10px] text-fuchsia-400 hover:text-fuchsia-300 sm:text-xs"
      >
        {t.seeMore} &rarr;
      </Link>
    </div>
  );
}
