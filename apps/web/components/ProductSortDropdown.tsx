'use client';

import { ProductSortDropdown as ProductSortDropdownBase } from '@adult-v/shared/components';

interface ProductSortDropdownProps {
  sortBy: string;
  basePath: string;
}

/**
 * Product sort dropdown for apps/web (dark theme)
 * Uses shared component from @adult-v/shared
 */
export default function ProductSortDropdown({ sortBy, basePath }: ProductSortDropdownProps) {
  return (
    <ProductSortDropdownBase
      sortBy={sortBy}
      basePath={basePath}
      theme="dark"
    />
  );
}
