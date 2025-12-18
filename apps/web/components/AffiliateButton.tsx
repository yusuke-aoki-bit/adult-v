'use client';

import { AffiliateButtonBase } from '@adult-v/shared/components/AffiliateButton';
import { getVariant, trackCtaClick } from '@/lib/ab-testing';

interface AffiliateButtonProps {
  affiliateUrl: string;
  providerLabel: string;
  provider?: string;
  productId?: number | string;
  price?: number;
  salePrice?: number;
  discount?: number;
}

/**
 * アフィリエイトボタンコンポーネント (Adult Viewer Lab)
 * アフィリエイトURLをそのまま使用
 */
export default function AffiliateButton(props: AffiliateButtonProps) {
  return (
    <AffiliateButtonBase
      {...props}
      convertFanzaUrls={false}
      getVariant={getVariant}
      trackCtaClick={trackCtaClick}
    />
  );
}
