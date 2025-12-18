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
 * アフィリエイトボタンコンポーネント (FANZA)
 * FANZAアフィリエイトURLを直リンクに変換
 */
export default function AffiliateButton(props: AffiliateButtonProps) {
  return (
    <AffiliateButtonBase
      {...props}
      convertFanzaUrls={true}
      getVariant={getVariant}
      trackCtaClick={trackCtaClick}
    />
  );
}
