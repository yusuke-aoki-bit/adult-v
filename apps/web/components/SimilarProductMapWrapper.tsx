'use client';

import { SimilarProductMap } from '@adult-v/shared/components';
import { useRouter } from 'next/navigation';
import { localizedHref } from '@adult-v/shared/i18n';

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
    router.push(localizedHref(`/products/${clickedProductId}`, locale));
  };

  return (
    <SimilarProductMap
      productId={productId}
      locale={locale}
      theme="dark"
      onProductClick={handleProductClick}
    />
  );
}
