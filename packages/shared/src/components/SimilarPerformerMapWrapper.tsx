'use client';

import { useRouter } from 'next/navigation';
import { SimilarPerformerMap } from './';

interface SimilarPerformerMapWrapperProps {
  performerId: number;
  locale: string;
}

export default function SimilarPerformerMapWrapper({ performerId, locale }: SimilarPerformerMapWrapperProps) {
  const router = useRouter();

  const handlePerformerClick = (id: number) => {
    router.push(`/${locale}/actress/${id}`);
  };

  return <SimilarPerformerMap performerId={performerId} locale={locale} onPerformerClick={handlePerformerClick} />;
}
