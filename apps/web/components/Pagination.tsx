'use client';

import { Suspense } from 'react';
import SharedPagination from '@adult-v/shared/components/Pagination';

// Initialize theme for dark mode (Adult Viewer Lab)
import { setThemeConfig } from '@adult-v/shared/lib/theme';
setThemeConfig({ mode: 'dark', primaryColor: 'rose' });

interface PaginationProps {
  total: number;
  page: number;
  perPage: number;
  basePath: string;
  queryParams?: Record<string, string>;
  position?: 'top' | 'bottom';
}

function PaginationInner(props: PaginationProps) {
  return <SharedPagination {...props} />;
}

export default function Pagination(props: PaginationProps) {
  return (
    <Suspense fallback={null}>
      <PaginationInner {...props} />
    </Suspense>
  );
}
