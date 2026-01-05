'use client';

import { PerPageDropdown as PerPageDropdownBase } from '@adult-v/shared/components';

interface PerPageDropdownProps {
  perPage: number;
  basePath: string;
}

/**
 * Per-page dropdown for apps/web (dark theme)
 * Uses shared component from @adult-v/shared
 */
export default function PerPageDropdown({ perPage, basePath }: PerPageDropdownProps) {
  return (
    <PerPageDropdownBase
      perPage={perPage}
      basePath={basePath}
      theme="dark"
    />
  );
}
