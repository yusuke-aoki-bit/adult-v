'use client';

import { ImageSearch } from '@adult-v/shared/components';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

interface ImageSearchWrapperProps {
  locale: string;
}

export default function ImageSearchWrapper({ locale }: ImageSearchWrapperProps) {
  const router = useRouter();

  const handleProductClick = useCallback((productId: string) => {
    router.push(`/${locale}/products/${productId}`);
  }, [router, locale]);

  return (
    <ImageSearch
      locale={locale}
      theme="dark"
      onProductClick={handleProductClick}
    />
  );
}
