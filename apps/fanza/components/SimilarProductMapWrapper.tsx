'use client';

import { SimilarProductMap } from '@adult-v/shared/components';
import { useRouter } from 'next/navigation';

interface SimilarProductMapWrapperProps {
  productId: number;
  locale: string;
}

export default function SimilarProductMapWrapper({
  productId,
  locale,
}: SimilarProductMapWrapperProps) {
  const router = useRouter();

  const handleProductClick = (clickedProductId: number) => {
    const path = locale === 'ja'
      ? `/products/${clickedProductId}`
      : `/${locale}/products/${clickedProductId}`;
    router.push(path);
  };

  return (
    <SimilarProductMap
      productId={productId}
      locale={locale}
      theme="light"
      onProductClick={handleProductClick}
    />
  );
}
