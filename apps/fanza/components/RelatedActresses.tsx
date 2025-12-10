'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';

interface RelatedActress {
  id: number;
  name: string;
  thumbnailUrl: string | null;
  heroImageUrl: string | null;
  sharedCount: number;
  productCount: number;
}

interface RelatedActressesProps {
  actresses: RelatedActress[];
  currentActressName: string;
}

const PLACEHOLDER_IMAGE = 'https://placehold.co/150x150/1f2937/ffffff?text=No+Image';

export default function RelatedActresses({ actresses, currentActressName }: RelatedActressesProps) {
  const locale = useLocale();
  const t = useTranslations('relatedActresses');

  if (actresses.length === 0) {
    return null;
  }

  return (
    <div className="mt-12 bg-gray-800 rounded-lg p-6">
      <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        {t('title', { name: currentActressName })}
      </h2>
      <p className="text-sm text-gray-400 mb-4">{t('description')}</p>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {actresses.map((actress) => (
          <Link
            key={actress.id}
            href={`/${locale}/actress/${actress.id}`}
            className="group text-center"
          >
            <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-700 mb-2 ring-2 ring-transparent group-hover:ring-rose-500 transition-all">
              <Image
                src={actress.heroImageUrl || actress.thumbnailUrl || PLACEHOLDER_IMAGE}
                alt={actress.name}
                fill
                className="object-cover group-hover:scale-105 transition-transform"
                sizes="(max-width: 768px) 33vw, (max-width: 1200px) 16vw, 10vw"
                loading="lazy"
              />
              {/* 共演回数バッジ */}
              <div className="absolute bottom-1 right-1 bg-rose-600 text-white text-[10px] px-1.5 py-0.5 rounded">
                {actress.sharedCount}{t('costarCount')}
              </div>
            </div>
            <p className="text-sm text-white group-hover:text-rose-400 transition-colors line-clamp-1">
              {actress.name}
            </p>
            <p className="text-xs text-gray-500">
              {actress.productCount}{t('productCount')}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
