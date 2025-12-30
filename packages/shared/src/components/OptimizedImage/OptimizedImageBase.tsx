'use client';

import Image from 'next/image';
import { useState } from 'react';

export type OptimizedImageTheme = 'dark' | 'light';

export interface OptimizedImageBaseProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  fill?: boolean;
  className?: string;
  priority?: boolean;
  sizes?: string;
  quality?: number;
  onLoad?: () => void;
  theme: OptimizedImageTheme;
}

const themeStyles = {
  dark: {
    shimmerColors: { start: '#1f2937', mid: '#374151', end: '#1f2937' },
    bgColor: '#1f2937',
    errorBg: 'bg-gray-800',
    errorIcon: 'text-gray-600',
  },
  light: {
    shimmerColors: { start: '#e5e7eb', mid: '#d1d5db', end: '#e5e7eb' },
    bgColor: '#e5e7eb',
    errorBg: 'bg-gray-100',
    errorIcon: 'text-gray-400',
  },
};

// 事前計算したblurDataURL（モジュールレベルで1回だけ生成）
const PRECOMPUTED_BLUR_DATA_URLS = {
  dark: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNzAwIiBoZWlnaHQ9IjQ3NSIgdmVyc2lvbj0iMS4xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciPjxzdG9wIHN0b3AtY29sb3I9IiMxZjI5MzciIG9mZnNldD0iMCUiIC8+PHN0b3Agc3RvcC1jb2xvcj0iIzM3NDE1MSIgb2Zmc2V0PSI1MCUiIC8+PHN0b3Agc3RvcC1jb2xvcj0iIzFmMjkzNyIgb2Zmc2V0PSIxMDAlIiAvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjxyZWN0IHdpZHRoPSI3MDAiIGhlaWdodD0iNDc1IiBmaWxsPSIjMWYyOTM3IiAvPjxyZWN0IGlkPSJyIiB3aWR0aD0iNzAwIiBoZWlnaHQ9IjQ3NSIgZmlsbD0idXJsKCNnKSIgLz48YW5pbWF0ZSB4bGluazpocmVmPSIjciIgYXR0cmlidXRlTmFtZT0ieCIgZnJvbT0iLTcwMCIgdG89IjcwMCIgZHVyPSIxcyIgcmVwZWF0Q291bnQ9ImluZGVmaW5pdGUiICAvPjwvc3ZnPg==',
  light: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNzAwIiBoZWlnaHQ9IjQ3NSIgdmVyc2lvbj0iMS4xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciPjxzdG9wIHN0b3AtY29sb3I9IiNlNWU3ZWIiIG9mZnNldD0iMCUiIC8+PHN0b3Agc3RvcC1jb2xvcj0iI2QxZDVkYiIgb2Zmc2V0PSI1MCUiIC8+PHN0b3Agc3RvcC1jb2xvcj0iI2U1ZTdlYiIgb2Zmc2V0PSIxMDAlIiAvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjxyZWN0IHdpZHRoPSI3MDAiIGhlaWdodD0iNDc1IiBmaWxsPSIjZTVlN2ViIiAvPjxyZWN0IGlkPSJyIiB3aWR0aD0iNzAwIiBoZWlnaHQ9IjQ3NSIgZmlsbD0idXJsKCNnKSIgLz48YW5pbWF0ZSB4bGluazpocmVmPSIjciIgYXR0cmlidXRlTmFtZT0ieCIgZnJvbT0iLTcwMCIgdG89IjcwMCIgZHVyPSIxcyIgcmVwZWF0Q291bnQ9ImluZGVmaW5pdGUiICAvPjwvc3ZnPg==',
};

/**
 * Optimized Image component with blur placeholder and error handling
 */
export function OptimizedImageBase({
  src,
  alt,
  width,
  height,
  fill = false,
  className = '',
  priority = false,
  sizes,
  quality = 75,
  onLoad,
  theme,
}: OptimizedImageBaseProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const styles = themeStyles[theme];

  // 事前計算したblurDataURLを使用（毎回の生成を回避）
  const blurDataURL = PRECOMPUTED_BLUR_DATA_URLS[theme];

  if (hasError) {
    return (
      <div
        className={`${styles.errorBg} flex items-center justify-center ${className}`}
        style={
          fill
            ? undefined
            : {
                width: width ? `${width}px` : '100%',
                height: height ? `${height}px` : 'auto',
              }
        }
      >
        <svg
          className={`w-12 h-12 ${styles.errorIcon}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
    );
  }

  const imageProps = {
    src,
    alt,
    quality,
    priority,
    className: `${className} ${isLoading ? 'blur-sm' : 'blur-0'} transition-all duration-300`,
    onLoad: () => {
      setIsLoading(false);
      onLoad?.();
    },
    onError: () => {
      setHasError(true);
      setIsLoading(false);
    },
    placeholder: 'blur' as const,
    blurDataURL,
    sizes: sizes || '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
  };

  if (fill) {
    // eslint-disable-next-line jsx-a11y/alt-text
    return <Image {...imageProps} fill />;
  }

  return (
    // eslint-disable-next-line jsx-a11y/alt-text
    <Image
      {...imageProps}
      width={width || 500}
      height={height || 300}
    />
  );
}
