'use client';

import { useFavorites } from '@adult-v/ui-common/hooks';
import { useTranslations } from 'next-intl';
import SharedFavoriteButton from '@adult-v/shared/components/FavoriteButton';

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
  const { isFavorite, toggleFavorite, isLoaded } = useFavorites();

  const favorite = isFavorite(type, id);

  const handleToggle = () => {
    toggleFavorite({
      type,
      id,
      title,
      name,
      thumbnail,
      image,
    });
  };

  return (
    <SharedFavoriteButton
      type={type}
      id={id}
      title={title}
      name={name}
      thumbnail={thumbnail}
      image={image}
      className={className}
      size={size}
      isFavorite={favorite}
      isLoaded={isLoaded}
      onToggle={handleToggle}
      theme="light"
      primaryColor="pink"
      labels={{
        addToFavorites: t('addToFavorites'),
        removeFromFavorites: t('removeFromFavorites'),
      }}
    />
  );
}
