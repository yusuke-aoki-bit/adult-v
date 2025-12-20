'use client';

import { FilterSortBarBase, type FilterSortBarBaseProps } from '@adult-v/shared/components';

type FilterSortBarProps = Omit<FilterSortBarBaseProps, 'theme'>;

/**
 * FilterSortBar for FANZA (light theme)
 */
export default function FilterSortBar(props: FilterSortBarProps) {
  return <FilterSortBarBase {...props} theme="light" />;
}
