'use client';

import { useWatchLater } from '@adult-v/shared/hooks';
import SharedWatchLaterButton from '@adult-v/shared/components/WatchLaterButton';

interface WatchLaterButtonProps {
  productId: number | string;
  title: string;
  thumbnail?: string;
  provider?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function WatchLaterButton({
  productId,
  title,
  thumbnail,
  provider,
  size = 'md',
  className = '',
}: WatchLaterButtonProps) {
  const { hasItem, toggleItem, isLoaded } = useWatchLater();

  const productIdStr = String(productId);
  const isAdded = hasItem(productIdStr);

  const handleToggle = () => {
    toggleItem({
      productId: productIdStr,
      title,
      thumbnail,
      provider,
    });
  };

  return (
    <SharedWatchLaterButton
      productId={productId}
      title={title}
      thumbnail={thumbnail}
      provider={provider}
      size={size}
      className={className}
      theme="dark"
      isAdded={isAdded}
      isLoaded={isLoaded}
      onToggle={handleToggle}
    />
  );
}
