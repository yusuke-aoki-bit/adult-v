'use client';

import { useRouter } from 'next/navigation';
import { SimilarPerformerMap } from './';
import { localizedHref } from '../i18n';

interface SimilarPerformerMapWrapperProps {
  performerId: number;
  locale: string;
}

export default function SimilarPerformerMapWrapper({ performerId, locale }: SimilarPerformerMapWrapperProps) {
  const router = useRouter();

  const handlePerformerClick = (id: number) => {
    router.push(localizedHref(`/actress/${id}`, locale));
  };

  return <SimilarPerformerMap performerId={performerId} locale={locale} onPerformerClick={handlePerformerClick} />;
}
