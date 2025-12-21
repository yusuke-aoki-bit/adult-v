'use client';

import { OptimizedImageBase, type OptimizedImageBaseProps } from '@adult-v/shared/components';

type OptimizedImageProps = Omit<OptimizedImageBaseProps, 'theme'>;

/**
 * OptimizedImage for adult-v (dark theme)
 */
export default function OptimizedImage(props: OptimizedImageProps) {
  return <OptimizedImageBase {...props} theme="dark" />;
}
