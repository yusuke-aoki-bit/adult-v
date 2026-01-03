'use client';

import { useRouter } from 'next/navigation';
import { PerformerRelationMap as SharedPerformerRelationMap } from '@adult-v/shared/components';

interface PerformerRelationMapProps {
  performerId: number;
  locale: string;
}

export default function PerformerRelationMap({ performerId, locale }: PerformerRelationMapProps) {
  const router = useRouter();

  const handlePerformerClick = (id: number) => {
    router.push(`/${locale}/actress/${id}`);
  };

  const handleProductClick = (productId: string) => {
    router.push(`/${locale}/products/${productId}`);
  };

  return (
    <SharedPerformerRelationMap
      performerId={performerId}
      locale={locale}
      theme="light"
      onPerformerClick={handlePerformerClick}
      onProductClick={handleProductClick}
    />
  );
}
