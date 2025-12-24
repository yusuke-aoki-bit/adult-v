'use client';

import Link from 'next/link';
import Image from 'next/image';

interface SimilarActress {
  id: number;
  name: string;
  thumbnailUrl: string | null;
  heroImageUrl: string | null;
  productCount: number;
  matchingTags: number;
  totalTags: number;
  genreMatchPercent: number;
  topMatchingGenres: string[];
}

interface SimilarActressesProps {
  actresses: SimilarActress[];
  currentActressName: string;
  locale: string;
  theme?: 'dark' | 'light';
  translations: {
    title: string;
    description: string;
    genreMatch: string;
    productCount: string;
    matchingGenres: string;
  };
}

const PLACEHOLDER_IMAGE = 'https://placehold.co/150x150/1f2937/ffffff?text=No+Image';

// ジャンル一致率に応じた色を返す
function getMatchColor(percent: number, theme: 'dark' | 'light'): string {
  if (theme === 'light') {
    if (percent >= 80) return 'text-green-600';
    if (percent >= 60) return 'text-yellow-600';
    if (percent >= 40) return 'text-orange-600';
    return 'text-gray-600';
  }
  if (percent >= 80) return 'text-green-400';
  if (percent >= 60) return 'text-yellow-400';
  if (percent >= 40) return 'text-orange-400';
  return 'text-gray-400';
}

export default function SimilarActresses({
  actresses,
  currentActressName,
  locale,
  theme = 'dark',
  translations,
}: SimilarActressesProps) {
  if (actresses.length === 0) {
    return null;
  }

  const isDark = theme === 'dark';

  return (
    <div className={`mt-12 rounded-lg p-6 ${isDark ? 'bg-purple-900/30' : 'bg-purple-50'}`}>
      <h2 className={`text-xl font-bold mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
        <svg className={`w-5 h-5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        {translations.title.replace('{name}', currentActressName)}
      </h2>
      <p className={`text-sm mb-4 ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
        {translations.description}
      </p>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {actresses.map((actress) => (
          <Link
            key={actress.id}
            href={`/${locale}/actress/${actress.id}`}
            className="group text-center"
          >
            <div className={`relative aspect-square rounded-lg overflow-hidden mb-2 ring-2 ring-transparent transition-all ${
              isDark ? 'bg-gray-700 group-hover:ring-purple-500' : 'bg-gray-200 group-hover:ring-purple-400'
            }`}>
              <Image
                src={actress.heroImageUrl || actress.thumbnailUrl || PLACEHOLDER_IMAGE}
                alt={actress.name}
                fill
                className="object-cover group-hover:scale-105 transition-transform"
                sizes="(max-width: 768px) 33vw, (max-width: 1200px) 16vw, 10vw"
                loading="lazy"
              />
              {/* ジャンル一致率バッジ */}
              <div className={`absolute top-1 left-1 text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                isDark ? 'bg-black/70' : 'bg-white/90'
              }`}>
                <span className={getMatchColor(actress.genreMatchPercent, theme)}>
                  {actress.genreMatchPercent}%
                </span>
                <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>{translations.genreMatch}</span>
              </div>
              {/* 一致ジャンル数バッジ */}
              <div className={`absolute bottom-1 right-1 text-white text-[10px] px-1.5 py-0.5 rounded ${
                isDark ? 'bg-purple-600' : 'bg-purple-500'
              }`}>
                {actress.matchingTags}/{actress.totalTags}
              </div>
            </div>
            <p className={`text-sm transition-colors line-clamp-1 ${
              isDark ? 'text-white group-hover:text-purple-400' : 'text-gray-900 group-hover:text-purple-600'
            }`}>
              {actress.name}
            </p>
            <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>
              {actress.productCount}{translations.productCount}
            </p>
            {/* 一致ジャンル表示 */}
            {actress.topMatchingGenres.length > 0 && (
              <p className={`text-[10px] mt-0.5 truncate ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
                {actress.topMatchingGenres.slice(0, 3).join(' / ')}
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
