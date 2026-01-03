'use client';

import { usePriceAlerts } from '@adult-v/shared/hooks';
import SharedPriceAlertButton from '@adult-v/shared/components/PriceAlertButton';

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
  const { hasAlert, getAlert, addAlert, removeAlert } = usePriceAlerts();

  const productIdStr = String(productId);
  const alert = getAlert(productIdStr);

  const handleSetAlert = (targetPrice: number) => {
    addAlert({
      productId: productIdStr,
      normalizedProductId: productIdStr,
      title,
      thumbnailUrl: thumbnail,
      currentPrice: currentPrice || 0,
      targetPrice,
      notifyOnAnySale: true,
    });
  };

  const handleRemoveAlert = () => {
    removeAlert(productIdStr);
  };

  return (
    <SharedPriceAlertButton
      productId={productId}
      title={title}
      thumbnail={thumbnail}
      provider={provider}
      currentPrice={currentPrice}
      hasAlert={hasAlert(productIdStr)}
      existingTargetPrice={alert?.targetPrice}
      isLoaded={true}
      size={size}
      theme="light"
      locale={locale}
      onSetAlert={handleSetAlert}
      onRemoveAlert={handleRemoveAlert}
    />
  );
}
