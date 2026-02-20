'use client';

import { AiActressProfile } from '@adult-v/shared/components';

interface AiActressProfileWrapperProps {
  actressId: string;
  locale: string;
}

export default function AiActressProfileWrapper({ actressId, locale }: AiActressProfileWrapperProps) {
  return (
    <AiActressProfile
      actressId={actressId}
      locale={locale}
      theme="light"
      apiEndpoint={`/api/actresses/${actressId}/generate-profile`}
      autoLoad={false}
    />
  );
}
