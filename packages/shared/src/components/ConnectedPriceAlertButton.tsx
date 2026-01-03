'use client';

import { usePriceAlerts } from '../hooks';
import { useSiteTheme } from '../contexts/SiteThemeContext';
import PriceAlertButton from './PriceAlertButton';

interface ConnectedPriceAlertButtonProps {
  productId: string | number;
  title: string;
  thumbnail?: string;
  provider?: string;
  currentPrice?: number;
  size?: 'sm' | 'md' | 'lg';
  locale?: string;
}

/**
 * PriceAlertButtonのロジック込みバージョン
 * usePriceAlerts hookとSiteThemeContextを使用して自動的にテーマを適用
 */
export default function ConnectedPriceAlertButton({
  productId,
  title,
  thumbnail,
  provider,
  currentPrice,
  size = 'md',
  locale = 'ja',
}: ConnectedPriceAlertButtonProps) {
  const { hasAlert, getAlert, addAlert, removeAlert } = usePriceAlerts();
  const { theme } = useSiteTheme();

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
    <PriceAlertButton
      productId={productId}
      title={title}
      thumbnail={thumbnail}
      provider={provider}
      currentPrice={currentPrice}
      hasAlert={hasAlert(productIdStr)}
      existingTargetPrice={alert?.targetPrice}
      isLoaded={true}
      size={size}
      theme={theme}
      locale={locale}
      onSetAlert={handleSetAlert}
      onRemoveAlert={handleRemoveAlert}
    />
  );
}
