'use client';

import { StickyCtaBase } from '@adult-v/shared/components';
import { useTranslations } from 'next-intl';

interface StickyCtaProps {
  affiliateUrl: string;
  providerLabel: string;
  price?: number;
  salePrice?: number;
  discount?: number;
  currency?: string;
  saleEndAt?: string | null;
}

export default function StickyCta(props: StickyCtaProps) {
  const t = useTranslations('stickyCta');

  return (
    <StickyCtaBase
      {...props}
      theme="dark"
      labels={{
        buyAt: t('buyAt', { provider: props.providerLabel }),
        buyAtSale: t('buyAtSale', { provider: props.providerLabel, discount: '{discount}' }),
        urgentHours: t('urgentHours', { hours: '{hours}' }),
        endsToday: t('endsToday'),
        endsSoon: t('endsSoon', { days: '{days}' }),
      }}
    />
  );
}
