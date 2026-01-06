'use client';

import { useWatchLater } from '../hooks';
import { useSiteTheme } from '../contexts/SiteThemeContext';
import WatchLaterButton from './WatchLaterButton';

interface ConnectedWatchLaterButtonProps {
  productId: number | string;
  title: string;
  thumbnail?: string;
  provider?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  labels?: {
    addToWatchLater: string;
    removeFromWatchLater: string;
    loading: string;
  };
}

/**
 * WatchLaterButtonのロジック込みバージョン
 * useWatchLater hookとSiteThemeContextを使用して自動的にテーマを適用
 */
export default function ConnectedWatchLaterButton({
  productId,
  title,
  thumbnail,
  provider,
  size = 'md',
  className = '',
  labels,
}: ConnectedWatchLaterButtonProps) {
  const { hasItem, toggleItem, isLoaded } = useWatchLater();
  const { theme } = useSiteTheme();

  const productIdStr = String(productId);
  const isAdded = hasItem(productIdStr);

  const handleToggle = () => {
    toggleItem({
      productId: productIdStr,
      title,
      ...(thumbnail && { thumbnail }),
      ...(provider && { provider }),
    });
  };

  return (
    <WatchLaterButton
      productId={productId}
      title={title}
      {...(thumbnail && { thumbnail })}
      {...(provider && { provider })}
      size={size}
      className={className}
      theme={theme}
      isAdded={isAdded}
      isLoaded={isLoaded}
      onToggle={handleToggle}
      {...(labels && { labels })}
    />
  );
}
