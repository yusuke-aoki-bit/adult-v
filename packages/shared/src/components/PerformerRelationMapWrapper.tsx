'use client';

import { useRouter } from 'next/navigation';
import { PerformerRelationMap } from './';

interface PerformerRelationMapWrapperProps {
  performerId: number;
  locale: string;
}

export default function PerformerRelationMapWrapper({ performerId, locale }: PerformerRelationMapWrapperProps) {
  const router = useRouter();

  const handlePerformerClick = (id: number) => {
    router.push(`/${locale}/actress/${id}`);
  };

  return <PerformerRelationMap performerId={performerId} locale={locale} onPerformerClick={handlePerformerClick} />;
}
