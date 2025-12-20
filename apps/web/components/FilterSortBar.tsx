'use client';

import { FilterSortBarBase, type FilterSortBarBaseProps } from '@adult-v/shared/components';

type FilterSortBarProps = Omit<FilterSortBarBaseProps, 'theme'>;

/**
 * FilterSortBar for adult-v (dark theme)
 */
export default function FilterSortBar(props: FilterSortBarProps) {
  return <FilterSortBarBase {...props} theme="dark" />;
}
