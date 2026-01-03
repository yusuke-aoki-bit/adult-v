'use client';

import { useFavorites } from '../hooks';
import { useSiteTheme } from '../contexts/SiteThemeContext';
import FavoriteButton from './FavoriteButton';

interface ConnectedFavoriteButtonProps {
  type: 'product' | 'actress';
  id: number | string;
  title?: string;
  name?: string;
  thumbnail?: string;
  image?: string;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  labels: {
    addToFavorites: string;
    removeFromFavorites: string;
  };
}

/**
 * FavoriteButtonのロジック込みバージョン
 * useFavorites hookとSiteThemeContextを使用して自動的にテーマを適用
 */
export default function ConnectedFavoriteButton({
  type,
  id,
  title,
  name,
  thumbnail,
  image,
  className = '',
  size = 'md',
  labels,
}: ConnectedFavoriteButtonProps) {
  const { isFavorite, toggleFavorite, isLoaded } = useFavorites();
  const { theme, primaryColor } = useSiteTheme();

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
    <FavoriteButton
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
      theme={theme}
      primaryColor={primaryColor}
      labels={labels}
    />
  );
}
