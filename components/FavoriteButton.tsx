'use client';

import { useFavorites } from '@/contexts/FavoritesContext';
import { Heart } from 'lucide-react';

interface FavoriteButtonProps {
  type: 'actress' | 'product';
  id: number | string;
  className?: string;
}

export default function FavoriteButton({ type, id, className = '' }: FavoriteButtonProps) {
  const {
    toggleActressFavorite,
    toggleProductFavorite,
    isActressFavorite,
    isProductFavorite
  } = useFavorites();

  const isFavorite = type === 'actress'
    ? isActressFavorite(id as number)
    : isProductFavorite(id as string);

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (type === 'actress') {
      toggleActressFavorite(id as number);
    } else {
      toggleProductFavorite(id as string);
    }
  };

  return (
    <button
      onClick={handleToggle}
      className={`p-2 rounded-full transition-colors ${
        isFavorite
          ? 'text-red-500 hover:text-red-600'
          : 'text-gray-400 hover:text-red-500'
      } ${className}`}
      aria-label={isFavorite ? 'お気に入りから削除' : 'お気に入りに追加'}
    >
      <Heart
        className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`}
      />
    </button>
  );
}
