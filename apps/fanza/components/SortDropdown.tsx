'use client';

import { SortDropdown as BaseSortDropdown } from '@adult-v/shared/components';
import type { SortByValue } from '@adult-v/shared/components';
import { useSiteTheme } from '@/lib/contexts/SiteContext';

interface SortDropdownProps {
  sortBy: SortByValue;
}

/**
 * SortDropdown wrapper - テーマはSiteContextから自動取得
 */
export default function SortDropdown({ sortBy }: SortDropdownProps) {
  const theme = useSiteTheme();
  return <BaseSortDropdown sortBy={sortBy} theme={theme} />;
}
