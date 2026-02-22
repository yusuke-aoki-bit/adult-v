'use client';

import ConnectedWatchLaterButton from './ConnectedWatchLaterButton';

interface WatchLaterButtonProps {
  productId: number | string;
  title: string;
  thumbnail?: string;
  provider?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function WatchLaterButtonBase({
  productId,
  title,
  thumbnail,
  provider,
  size = 'md',
  className = '',
}: WatchLaterButtonProps) {
  return (
    <ConnectedWatchLaterButton
      productId={productId}
      title={title}
      thumbnail={thumbnail}
      provider={provider}
      size={size}
      className={className}
    />
  );
}
