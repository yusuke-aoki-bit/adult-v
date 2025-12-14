'use client';

import SharedPagination from '@adult-v/shared/components/Pagination';
import { savePerPage } from '@/lib/filter-storage';

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
  showPerPageSelector?: boolean;
}

export default function Pagination(props: PaginationProps) {
  return (
    <SharedPagination
      {...props}
      onSavePerPage={savePerPage}
    />
  );
}
