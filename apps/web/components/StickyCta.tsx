'use client';

import { useCallback } from 'react';
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

  const trackCtaClick = useCallback(
    (params: { provider: string; isSale: boolean; device: 'mobile' | 'desktop'; price?: number }) => {
      if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
        window.gtag('event', 'sticky_cta_click', {
          provider: params.provider,
          is_sale: params.isSale,
          device: params.device,
          price: params.price,
        });
      }
    },
    [],
  );

  return (
    <StickyCtaBase
      {...props}
      theme="dark"
      showTrustBadge={true}
      trackCtaClick={trackCtaClick}
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
