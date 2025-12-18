'use client';

import { AgeVerification as AgeVerificationBase } from '@adult-v/shared/components';
import { ComponentProps } from 'react';

type AgeVerificationProps = Omit<ComponentProps<typeof AgeVerificationBase>, 'theme'>;

/**
 * AgeVerification for apps/fanza (light theme)
 */
export default function AgeVerification(props: AgeVerificationProps) {
  return <AgeVerificationBase {...props} theme="light" />;
}
