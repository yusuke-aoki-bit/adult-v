'use client';

import { useRouter } from 'next/navigation';
import { SimilarPerformerMap as SharedSimilarPerformerMap } from '@adult-v/shared/components';

interface SimilarPerformerMapProps {
  performerId: number;
  locale: string;
}

export default function SimilarPerformerMap({ performerId, locale }: SimilarPerformerMapProps) {
  const router = useRouter();

  const handlePerformerClick = (id: number) => {
    router.push(`/${locale}/actress/${id}`);
  };

  return (
    <SharedSimilarPerformerMap
      performerId={performerId}
      locale={locale}
      theme="light"
      onPerformerClick={handlePerformerClick}
    />
  );
}
