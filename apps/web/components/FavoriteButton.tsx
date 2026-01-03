'use client';

import { useTranslations } from 'next-intl';
import { ConnectedFavoriteButton } from '@adult-v/shared/components';

interface FavoriteButtonProps {
  type: 'product' | 'actress';
  id: number | string;
  title?: string;
  name?: string;
  thumbnail?: string;
  image?: string;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export default function FavoriteButton({
  type,
  id,
  title,
  name,
  thumbnail,
  image,
  className = '',
  size = 'md',
}: FavoriteButtonProps) {
  const t = useTranslations('favoriteButton');

  return (
    <ConnectedFavoriteButton
      type={type}
      id={id}
      title={title}
      name={name}
      thumbnail={thumbnail}
      image={image}
      className={className}
      size={size}
      labels={{
        addToFavorites: t('addToFavorites'),
        removeFromFavorites: t('removeFromFavorites'),
      }}
    />
  );
}
