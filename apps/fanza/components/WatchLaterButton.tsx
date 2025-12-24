'use client';

import { useWatchLater } from '@adult-v/ui-common/hooks';
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
  const { isInWatchLater, toggleWatchLater, isLoaded } = useWatchLater();

  const isAdded = isInWatchLater(productId);

  const handleToggle = () => {
    toggleWatchLater({
      id: productId,
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
      theme="light"
      isAdded={isAdded}
      isLoaded={isLoaded}
      onToggle={handleToggle}
    />
  );
}
