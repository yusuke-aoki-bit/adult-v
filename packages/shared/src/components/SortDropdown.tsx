'use client';

import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { useCallback, memo } from 'react';

export type SortDropdownTheme = 'dark' | 'light';

// Client-side translations (ConditionalLayout is outside NextIntlClientProvider)
const translations = {
  ja: {
    sortLabel: '並び順:',
    nameAsc: '名前順（あ→ん）',
    nameDesc: '名前順（ん→あ）',
    productCountDesc: '作品数順（多い順）',
    productCountAsc: '作品数順（少ない順）',
    recent: '新着順',
  },
  en: {
    sortLabel: 'Sort:',
    nameAsc: 'Name (A-Z)',
    nameDesc: 'Name (Z-A)',
    productCountDesc: 'Most Videos',
    productCountAsc: 'Least Videos',
    recent: 'Recently Added',
  },
  zh: {
    sortLabel: '排序:',
    nameAsc: '名称 (A→Z)',
    nameDesc: '名称 (Z→A)',
    productCountDesc: '作品数（多到少）',
    productCountAsc: '作品数（少到多）',
    recent: '最新添加',
  },
  ko: {
    sortLabel: '정렬:',
    nameAsc: '이름순 (가→하)',
    nameDesc: '이름순 (하→가)',
    productCountDesc: '작품 수 (많은순)',
    productCountAsc: '작품 수 (적은순)',
    recent: '최신 추가순',
  },
} as const;

// Theme configuration
const themeConfig = {
  dark: {
    label: 'text-sm font-medium text-gray-300',
    select: 'px-3 py-2 border border-gray-600 rounded-md text-sm text-white bg-gray-700 focus:ring-rose-500 focus:border-rose-500',
  },
  light: {
    label: 'text-sm font-medium text-gray-600',
    select: 'px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-800 bg-white focus:ring-rose-700 focus:border-rose-700',
  },
} as const;

export type SortByValue = 'nameAsc' | 'nameDesc' | 'productCountDesc' | 'productCountAsc' | 'recent';

interface SortDropdownProps {
  sortBy: SortByValue;
  theme?: SortDropdownTheme;
}

function SortDropdownComponent({ sortBy, theme = 'dark' }: SortDropdownProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const locale = (params?.locale as string) || 'ja';
  const t = translations[locale as keyof typeof translations] || translations.ja;
  const colors = themeConfig[theme];

  const handleSortChange = useCallback((newSort: string) => {
    const urlParams = new URLSearchParams(searchParams.toString());
    urlParams.set('sort', newSort);
    urlParams.delete('page'); // Reset to page 1 when sorting changes
    router.push(`/${locale}/?${urlParams.toString()}`);
  }, [searchParams, router, locale]);

  return (
    <div className="flex items-center gap-2 h-[40px]">
      <label htmlFor="sort" className={colors.label}>
        {t.sortLabel}
      </label>
      <select
        id="sort"
        name="sort"
        value={sortBy}
        onChange={(e) => handleSortChange(e.target.value)}
        className={colors.select}
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
