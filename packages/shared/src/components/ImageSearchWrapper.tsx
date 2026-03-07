'use client';

import { ImageSearch } from './';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { localizedHref } from '../i18n';

interface ImageSearchWrapperProps {
  locale: string;
}

export default function ImageSearchWrapper({ locale }: ImageSearchWrapperProps) {
  const router = useRouter();

  const handleProductClick = useCallback(
    (productId: string) => {
      router.push(localizedHref(`/products/${productId}`, locale));
    },
    [router, locale],
  );

  return <ImageSearch locale={locale} onProductClick={handleProductClick} />;
}
