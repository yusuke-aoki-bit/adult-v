'use client';

import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { getFilterThemeConfig, type FilterTheme } from './theme';
import { getPerPageTranslation } from './translations';

interface PerPageDropdownProps {
  perPage: number;
  basePath: string;
  theme: FilterTheme;
  options?: number[];
}

const DEFAULT_OPTIONS = [12, 24, 48, 96];

export default function PerPageDropdown({
  perPage,
  basePath,
  theme,
  options = DEFAULT_OPTIONS,
}: PerPageDropdownProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const locale = (params?.['locale'] as string) || 'ja';
  const t = getPerPageTranslation(locale);
  const themeConfig = getFilterThemeConfig(theme);

  const handlePerPageChange = (newPerPage: string) => {
    const urlParams = new URLSearchParams(searchParams.toString());
    // デフォルト値(48)の場合はパラメータを削除
    if (newPerPage === '48') {
      urlParams.delete('perPage');
    } else {
      urlParams.set('perPage', newPerPage);
    }
    urlParams.delete('page'); // Reset to page 1 when perPage changes
    router.push(`${basePath}?${urlParams.toString()}`);
  };

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="per-page" className={themeConfig.sortDropdown.labelClass}>
        {t.perPageLabel}
      </label>
      <select
        id="per-page"
        name="perPage"
        value={perPage}
        onChange={(e) => handlePerPageChange(e.target.value)}
        className={themeConfig.sortDropdown.selectClass}
        aria-label={t.perPageLabel}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}{t.items}
          </option>
        ))}
      </select>
    </div>
  );
}
