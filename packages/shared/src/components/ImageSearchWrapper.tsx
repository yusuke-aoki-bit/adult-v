'use client';

import { ImageSearch } from './';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

interface ImageSearchWrapperProps {
  locale: string;
}

export default function ImageSearchWrapper({ locale }: ImageSearchWrapperProps) {
  const router = useRouter();

  const handleProductClick = useCallback(
    (productId: string) => {
      router.push(`/${locale}/products/${productId}`);
    },
    [router, locale],
  );

  return <ImageSearch locale={locale} onProductClick={handleProductClick} />;
}
