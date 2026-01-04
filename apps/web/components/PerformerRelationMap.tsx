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

  return (
    <SharedPerformerRelationMap
      performerId={performerId}
      locale={locale}
      theme="dark"
      onPerformerClick={handlePerformerClick}
    />
  );
}
