'use client';

import { useTranslations } from 'next-intl';
import ConnectedFavoriteButton from './ConnectedFavoriteButton';

interface ActressFavoriteButtonProps {
  id: string | number;
  name: string;
  thumbnail?: string;
}

export default function ActressFavoriteButton({ id, name, thumbnail }: ActressFavoriteButtonProps) {
  const t = useTranslations('favoriteButton');

  return (
    <ConnectedFavoriteButton
      type="actress"
      id={id}
      name={name}
      thumbnail={thumbnail}
      size="md"
      labels={{
        addToFavorites: t('addToFavorites'),
        removeFromFavorites: t('removeFromFavorites'),
      }}
    />
  );
}
