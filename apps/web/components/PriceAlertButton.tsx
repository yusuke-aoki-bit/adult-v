'use client';

import { ConnectedPriceAlertButton } from '@adult-v/shared/components';

interface PriceAlertButtonProps {
  productId: string | number;
  title: string;
  thumbnail?: string;
  provider?: string;
  currentPrice?: number;
  size?: 'sm' | 'md' | 'lg';
  locale?: string;
}

export default function PriceAlertButton({
  productId,
  title,
  thumbnail,
  provider,
  currentPrice,
  size = 'md',
  locale = 'ja',
}: PriceAlertButtonProps) {
  return (
    <ConnectedPriceAlertButton
      productId={productId}
      title={title}
      thumbnail={thumbnail}
      provider={provider}
      currentPrice={currentPrice}
      size={size}
      locale={locale}
    />
  );
}
