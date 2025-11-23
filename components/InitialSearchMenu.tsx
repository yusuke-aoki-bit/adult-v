'use client';

import { useState } from 'react';
import Link from 'next/link';

interface InitialSearchMenuProps {
  locale: string;
  initialFilter: string | null;
  sortBy: string;
  includeTags: number[];
  excludeTags: number[];
}

// ひらがなのマッピング
const HIRAGANA_GROUPS = {
  'あ': ['あ', 'い', 'う', 'え', 'お'],
  'か': ['か', 'き', 'く', 'け', 'こ'],
  'さ': ['さ', 'し', 'す', 'せ', 'そ'],
  'た': ['た', 'ち', 'つ', 'て', 'と'],
  'な': ['な', 'に', 'ぬ', 'ね', 'の'],
  'は': ['は', 'ひ', 'ふ', 'へ', 'ほ'],
  'ま': ['ま', 'み', 'む', 'め', 'も'],
  'や': ['や', 'ゆ', 'よ'],
  'ら': ['ら', 'り', 'る', 'れ', 'ろ'],
  'わ': ['わ', 'を', 'ん'],
};

export default function InitialSearchMenu({
  locale,
  initialFilter,
  sortBy,
  includeTags,
  excludeTags,
}: InitialSearchMenuProps) {
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);

  const buildUrl = (initial: string) => {
    const params = new URLSearchParams();
    params.set('initial', initial);
    if (sortBy !== 'nameAsc') params.set('sort', sortBy);
    if (includeTags.length > 0) params.set('include', includeTags.join(','));
    if (excludeTags.length > 0) params.set('exclude', excludeTags.join(','));
    return `/${locale}?${params.toString()}`;
  };

  return (
    <div className="flex flex-wrap gap-2">
      {/* ひらがなグループ */}
      {Object.entries(HIRAGANA_GROUPS).map(([group, chars]) => (
        <div
          key={group}
          className="relative"
          onMouseEnter={() => setHoveredGroup(group)}
          onMouseLeave={() => setHoveredGroup(null)}
        >
          <button
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              chars.some(c => initialFilter === c)
                ? 'bg-rose-600 text-white'
                : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
            }`}
          >
            {group}
          </button>

          {/* ドロップダウンメニュー */}
          {hoveredGroup === group && (
            <div
              className="absolute top-full left-0 pt-1 z-10"
              onMouseEnter={() => setHoveredGroup(group)}
              onMouseLeave={() => setHoveredGroup(null)}
            >
              <div className="bg-gray-800 border border-gray-600 rounded shadow-lg p-2 flex gap-1">
                {chars.map((char) => (
                  <Link
                    key={char}
                    href={buildUrl(char)}
                    className={`px-2 py-1 rounded text-sm font-medium transition-colors whitespace-nowrap ${
                      initialFilter === char
                        ? 'bg-rose-600 text-white'
                        : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                    }`}
                  >
                    {char}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}

      {/* アルファベット */}
      {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'].map((char) => (
        <Link
          key={char}
          href={buildUrl(char)}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
            initialFilter === char
              ? 'bg-rose-600 text-white'
              : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
          }`}
        >
          {char}
        </Link>
      ))}

      {/* その他 */}
      <Link
        href={buildUrl('etc')}
        className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
          initialFilter === 'etc'
            ? 'bg-rose-600 text-white'
            : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
        }`}
      >
        その他
      </Link>
    </div>
  );
}
