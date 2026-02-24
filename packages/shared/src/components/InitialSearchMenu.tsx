'use client';

import { useState, useCallback, memo } from 'react';
import Link from 'next/link';
import { useSiteTheme } from '../contexts/SiteThemeContext';
import { getTranslation, initialSearchMenuTranslations } from '../lib/translations';

interface InitialSearchMenuProps {
  locale: string;
  initialFilter: string | null;
  sortBy: string;
  includeTags: number[];
  excludeTags: number[];
}

// ひらがなのマッピング
const HIRAGANA_GROUPS = {
  あ: ['あ', 'い', 'う', 'え', 'お'],
  か: ['か', 'き', 'く', 'け', 'こ'],
  さ: ['さ', 'し', 'す', 'せ', 'そ'],
  た: ['た', 'ち', 'つ', 'て', 'と'],
  な: ['な', 'に', 'ぬ', 'ね', 'の'],
  は: ['は', 'ひ', 'ふ', 'へ', 'ほ'],
  ま: ['ま', 'み', 'む', 'め', 'も'],
  や: ['や', 'ゆ', 'よ'],
  ら: ['ら', 'り', 'る', 'れ', 'ろ'],
  わ: ['わ', 'を', 'ん'],
};

function InitialSearchMenu({ locale, initialFilter, sortBy, includeTags, excludeTags }: InitialSearchMenuProps) {
  const { theme, primaryColor } = useSiteTheme();
  const isDark = theme === 'dark';
  const activeColor = primaryColor === 'rose' ? 'bg-fuchsia-600' : 'bg-fuchsia-500';
  const hoverInactive = isDark ? 'hover:bg-gray-600' : 'hover:bg-pink-50';

  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  const t = getTranslation(initialSearchMenuTranslations, locale);

  const buildUrl = useCallback(
    (initial: string) => {
      const params = new URLSearchParams();
      params.set('initial', initial);
      if (sortBy !== 'nameAsc') params.set('sort', sortBy);
      if (includeTags.length > 0) params.set('include', includeTags.join(','));
      if (excludeTags.length > 0) params.set('exclude', excludeTags.join(','));
      return `/${locale}?${params.toString()}`;
    },
    [locale, sortBy, includeTags, excludeTags],
  );

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
            className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
              chars.some((c) => initialFilter === c)
                ? `${activeColor} text-white`
                : isDark
                  ? `bg-gray-700 text-gray-200 ${hoverInactive}`
                  : `bg-gray-100 text-gray-700 ${hoverInactive}`
            }`}
          >
            {group}
          </button>

          {/* ドロップダウンメニュー */}
          {hoveredGroup === group && (
            <div
              className="absolute top-full left-0 z-10 pt-1"
              onMouseEnter={() => setHoveredGroup(group)}
              onMouseLeave={() => setHoveredGroup(null)}
            >
              <div
                className={`${isDark ? 'border-gray-600 bg-gray-800' : 'border-gray-200 bg-white'} flex gap-1 rounded border p-2 shadow-lg`}
              >
                {chars.map((char) => (
                  <Link
                    key={char}
                    href={buildUrl(char)}
                    className={`rounded px-2 py-1 text-sm font-medium whitespace-nowrap transition-colors ${
                      initialFilter === char
                        ? `${activeColor} text-white`
                        : isDark
                          ? `bg-gray-700 text-gray-200 ${hoverInactive}`
                          : `bg-gray-100 text-gray-700 ${hoverInactive}`
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
      {[
        'A',
        'B',
        'C',
        'D',
        'E',
        'F',
        'G',
        'H',
        'I',
        'J',
        'K',
        'L',
        'M',
        'N',
        'O',
        'P',
        'Q',
        'R',
        'S',
        'T',
        'U',
        'V',
        'W',
        'X',
        'Y',
        'Z',
      ].map((char) => (
        <Link
          key={char}
          href={buildUrl(char)}
          className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
            initialFilter === char
              ? `${activeColor} text-white`
              : isDark
                ? `bg-gray-700 text-gray-200 ${hoverInactive}`
                : `bg-gray-100 text-gray-700 ${hoverInactive}`
          }`}
        >
          {char}
        </Link>
      ))}

      {/* その他 */}
      <Link
        href={buildUrl('etc')}
        className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
          initialFilter === 'etc'
            ? `${activeColor} text-white`
            : isDark
              ? `bg-gray-700 text-gray-200 ${hoverInactive}`
              : `bg-gray-100 text-gray-700 ${hoverInactive}`
        }`}
      >
        {t.etc}
      </Link>
    </div>
  );
}

export default memo(InitialSearchMenu);
