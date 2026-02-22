'use client';

import { AiActressProfile } from './';

interface AiActressProfileWrapperProps {
  actressId: string;
  locale: string;
}

export default function AiActressProfileWrapper({ actressId, locale }: AiActressProfileWrapperProps) {
  return (
    <AiActressProfile
      actressId={actressId}
      locale={locale}
      apiEndpoint={`/api/actresses/${actressId}/generate-profile`}
      autoLoad={false}
    />
  );
}
