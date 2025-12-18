'use client';

import { RetirementAlert as RetirementAlertBase } from '@adult-v/shared/components';
import { ComponentProps } from 'react';

type RetirementAlertProps = Omit<ComponentProps<typeof RetirementAlertBase>, 'theme'>;

/**
 * RetirementAlert for apps/fanza (light theme)
 */
export default function RetirementAlert(props: RetirementAlertProps) {
  return <RetirementAlertBase {...props} theme="light" />;
}
