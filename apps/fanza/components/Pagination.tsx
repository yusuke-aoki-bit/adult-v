'use client';

import { Suspense } from 'react';
import SharedPagination from '@adult-v/shared/components/Pagination';
import { savePerPage } from '@/lib/filter-storage';

// Initialize theme for light mode (AVVIEWER LAB / FANZA)
import { setThemeConfig } from '@adult-v/shared/lib/theme';
setThemeConfig({ mode: 'light', primaryColor: 'pink' });

interface PaginationProps {
  total: number;
  page: number;
  perPage: number;
  basePath: string;
  queryParams?: Record<string, string>;
  position?: 'top' | 'bottom';
  showPerPageSelector?: boolean;
}

function PaginationInner(props: PaginationProps) {
  return (
    <SharedPagination
      {...props}
      onSavePerPage={savePerPage}
    />
  );
}

export default function Pagination(props: PaginationProps) {
  return (
    <Suspense fallback={null}>
      <PaginationInner {...props} />
    </Suspense>
  );
}
