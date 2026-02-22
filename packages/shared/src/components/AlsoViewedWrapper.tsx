'use client';

import { AlsoViewed } from './';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

interface AlsoViewedWrapperProps {
  productId: string;
  locale: string;
}

export default function AlsoViewedWrapper({ productId, locale }: AlsoViewedWrapperProps) {
  const router = useRouter();

  const handleProductClick = useCallback((id: string) => {
    router.push(`/${locale}/products/${id}`);
  }, [router, locale]);

  return (
    <AlsoViewed
      productId={productId}
      locale={locale}
      onProductClick={handleProductClick}
      limit={6}
    />
  );
}
