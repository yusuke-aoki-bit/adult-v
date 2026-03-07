'use client';

import { useRouter } from 'next/navigation';
import { PerformerRelationMap } from './';
import { localizedHref } from '../i18n';

interface PerformerRelationMapWrapperProps {
  performerId: number;
  locale: string;
}

export default function PerformerRelationMapWrapper({ performerId, locale }: PerformerRelationMapWrapperProps) {
  const router = useRouter();

  const handlePerformerClick = (id: number) => {
    router.push(localizedHref(`/actress/${id}`, locale));
  };

  return <PerformerRelationMap performerId={performerId} locale={locale} onPerformerClick={handlePerformerClick} />;
}
