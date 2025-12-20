'use client';

import { SortDropdown as BaseSortDropdown } from '@adult-v/shared/components';
import type { SortByValue } from '@adult-v/shared/components';

interface SortDropdownProps {
  sortBy: SortByValue;
}

/**
 * SortDropdown wrapper for apps/fanza (light theme)
 */
export default function SortDropdown({ sortBy }: SortDropdownProps) {
  return <BaseSortDropdown sortBy={sortBy} theme="light" />;
}
