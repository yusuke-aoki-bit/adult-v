'use client';

import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { getFilterThemeConfig, type FilterTheme } from './theme';
import { getSortTranslation } from './translations';

interface ProductSortDropdownProps {
  sortBy: string;
  basePath: string;
  theme: FilterTheme;
}

export default function ProductSortDropdown({ sortBy, basePath, theme }: ProductSortDropdownProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const locale = (params?.['locale'] as string) || 'ja';
  const t = getSortTranslation(locale);
  const themeConfig = getFilterThemeConfig(theme);

  const handleSortChange = (newSort: string) => {
    const urlParams = new URLSearchParams(searchParams.toString());
    urlParams.set('sort', newSort);
    urlParams.delete('page'); // Reset to page 1 when sorting changes
    router.push(`${basePath}?${urlParams.toString()}`);
  };

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="product-sort" className={themeConfig.sortDropdown.labelClass}>
        {t.sortLabel}
      </label>
      <select
        id="product-sort"
        name="sort"
        value={sortBy}
        onChange={(e) => handleSortChange(e.target.value)}
        className={themeConfig.sortDropdown.selectClass}
        aria-label={t.sortLabel}
      >
        <option value="releaseDateDesc">{t.releaseDateDesc}</option>
        <option value="releaseDateAsc">{t.releaseDateAsc}</option>
        <option value="priceAsc">{t.priceAsc}</option>
        <option value="priceDesc">{t.priceDesc}</option>
        <option value="ratingDesc">{t.ratingDesc}</option>
        <option value="reviewCountDesc">{t.reviewCountDesc}</option>
        <option value="durationDesc">{t.durationDesc}</option>
        <option value="durationAsc">{t.durationAsc}</option>
        <option value="titleAsc">{t.titleAsc}</option>
        <option value="random">{t.random}</option>
      </select>
    </div>
  );
}
