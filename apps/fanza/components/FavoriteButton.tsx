'use client';

import { Heart } from 'lucide-react';
import { useFavorites } from '@/hooks/useFavorites';
import { useTranslations } from 'next-intl';

interface FavoriteButtonProps {
  type: 'product' | 'actress';
  id: number | string;
  title?: string;
  name?: string;
  thumbnail?: string;
  image?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
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

  if (!isLoaded) {
    return null; // Don't render until localStorage is loaded
  }

  const favorite = isFavorite(type, id);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    toggleFavorite({
      type,
      id,
      title,
      name,
      thumbnail,
      image,
    });
  };

  const sizeClasses = {
    sm: 'w-8 h-8 p-1.5',
    md: 'w-10 h-10 p-2',
    lg: 'w-12 h-12 p-2.5',
  };

  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  return (
    <button
      onClick={handleClick}
      className={`
        ${sizeClasses[size]}
        rounded-full
        transition-all
        duration-200
        active:scale-110
        ${
          favorite
            ? 'bg-rose-700 text-white hover:bg-rose-800 hover:scale-105'
            : 'bg-white/90 text-gray-500 hover:bg-gray-100 hover:text-rose-700 hover:scale-105 border border-gray-200'
        }
        backdrop-blur-sm
        flex
        items-center
        justify-center
        ${className}
      `}
      title={favorite ? t('removeFromFavorites') : t('addToFavorites')}
      aria-label={favorite ? t('removeFromFavorites') : t('addToFavorites')}
    >
      <Heart
        className={`${iconSizes[size]} ${favorite ? 'fill-current' : ''}`}
      />
    </button>
  );
}
