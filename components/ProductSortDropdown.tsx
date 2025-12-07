'use client';

import { useRouter, useSearchParams, useParams } from 'next/navigation';

// Client-side translations
const translations = {
  ja: {
    sortLabel: '並び順:',
    releaseDateDesc: '新しい順',
    releaseDateAsc: '古い順',
    priceAsc: '価格が安い順',
    priceDesc: '価格が高い順',
    titleAsc: 'タイトル順',
  },
  en: {
    sortLabel: 'Sort:',
    releaseDateDesc: 'Newest First',
    releaseDateAsc: 'Oldest First',
    priceAsc: 'Price: Low to High',
    priceDesc: 'Price: High to Low',
    titleAsc: 'Title (A-Z)',
  },
  zh: {
    sortLabel: '排序:',
    releaseDateDesc: '最新优先',
    releaseDateAsc: '最早优先',
    priceAsc: '价格：从低到高',
    priceDesc: '价格：从高到低',
    titleAsc: '标题 (A-Z)',
  },
  ko: {
    sortLabel: '정렬:',
    releaseDateDesc: '최신순',
    releaseDateAsc: '오래된순',
    priceAsc: '가격: 낮은순',
    priceDesc: '가격: 높은순',
    titleAsc: '제목순 (가나다)',
  },
} as const;

interface ProductSortDropdownProps {
  sortBy: string;
  basePath: string;
}

export default function ProductSortDropdown({ sortBy, basePath }: ProductSortDropdownProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const locale = (params?.locale as string) || 'ja';
  const t = translations[locale as keyof typeof translations] || translations.ja;

  const handleSortChange = (newSort: string) => {
    const urlParams = new URLSearchParams(searchParams.toString());
    urlParams.set('sort', newSort);
    urlParams.delete('page'); // Reset to page 1 when sorting changes
    router.push(`${basePath}?${urlParams.toString()}`);
  };

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="product-sort" className="text-sm font-medium text-gray-300">
        {t.sortLabel}
      </label>
      <select
        id="product-sort"
        name="sort"
        value={sortBy}
        onChange={(e) => handleSortChange(e.target.value)}
        className="px-3 py-2 border border-gray-600 rounded-md text-sm text-white bg-gray-700 focus:ring-rose-500 focus:border-rose-500"
      >
        <option value="releaseDateDesc">{t.releaseDateDesc}</option>
        <option value="releaseDateAsc">{t.releaseDateAsc}</option>
        <option value="priceAsc">{t.priceAsc}</option>
        <option value="priceDesc">{t.priceDesc}</option>
        <option value="titleAsc">{t.titleAsc}</option>
      </select>
    </div>
  );
}
