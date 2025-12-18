'use client';

import { Breadcrumb as BreadcrumbBase } from '@adult-v/shared/components';
import type { BreadcrumbItem } from '@adult-v/shared/components';
import { ComponentProps } from 'react';

// Re-export BreadcrumbItem type
export type { BreadcrumbItem };

type BreadcrumbProps = Omit<ComponentProps<typeof BreadcrumbBase>, 'theme'>;

/**
 * Breadcrumb for apps/web (dark theme)
 */
export default function Breadcrumb(props: BreadcrumbProps) {
  return <BreadcrumbBase {...props} theme="dark" />;
}
