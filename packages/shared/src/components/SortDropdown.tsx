'use client';

import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { useCallback, memo } from 'react';
import { useSiteTheme } from '../contexts/SiteThemeContext';
import { getTranslation, sortDropdownTranslations } from '../lib/translations';

export type SortDropdownTheme = 'dark' | 'light';

// Theme configuration
const themeConfig = {
  dark: {
    label: 'text-sm font-medium text-gray-300',
    select:
      'px-3 py-2 border border-gray-600 rounded-md text-sm text-white bg-gray-700 focus:ring-rose-500 focus:border-rose-500',
  },
  light: {
    label: 'text-sm font-medium text-gray-600',
    select:
      'px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-800 bg-white focus:ring-rose-700 focus:border-rose-700',
  },
} as const;

export type SortByValue = 'nameAsc' | 'nameDesc' | 'productCountDesc' | 'productCountAsc' | 'recent';

interface SortDropdownProps {
  sortBy: SortByValue;
  theme?: SortDropdownTheme;
}

function SortDropdownComponent({ sortBy, theme: themeProp }: SortDropdownProps) {
  const { theme: contextTheme } = useSiteTheme();
  const theme = (themeProp ?? contextTheme) as SortDropdownTheme;
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const locale = (params?.['locale'] as string) || 'ja';
  const t = getTranslation(sortDropdownTranslations, locale);
  const colors = themeConfig[theme];

  const handleSortChange = useCallback(
    (newSort: string) => {
      const urlParams = new URLSearchParams(searchParams.toString());
      urlParams.set('sort', newSort);
      urlParams.delete('page'); // Reset to page 1 when sorting changes
      router.push(`/${locale}/?${urlParams.toString()}`);
    },
    [searchParams, router, locale],
  );

  return (
    <div className="flex h-[40px] items-center gap-2">
      <label htmlFor="sort" className={colors.label}>
        {t.sortLabel}
      </label>
      <select
        id="sort"
        name="sort"
        value={sortBy}
        onChange={(e) => handleSortChange(e.target.value)}
        className={colors.select}
        aria-label={t.sortLabel}
      >
        <option value="nameAsc">{t.nameAsc}</option>
        <option value="nameDesc">{t.nameDesc}</option>
        <option value="productCountDesc">{t.productCountDesc}</option>
        <option value="productCountAsc">{t.productCountAsc}</option>
        <option value="recent">{t.recent}</option>
      </select>
    </div>
  );
}

// Memoize to prevent re-renders when parent updates but sortBy unchanged
const SortDropdown = memo(SortDropdownComponent);
export default SortDropdown;
