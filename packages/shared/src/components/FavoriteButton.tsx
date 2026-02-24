'use client';

import { Heart } from 'lucide-react';
import { useSiteTheme } from '../contexts/SiteThemeContext';

type ThemeMode = 'dark' | 'light';
type PrimaryColor = 'fuchsia' | 'rose' | 'pink';

interface FavoriteButtonProps {
  type: 'product' | 'actress';
  id: number | string;
  title?: string;
  name?: string;
  thumbnail?: string;
  image?: string;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  isFavorite: boolean;
  isLoaded: boolean;
  onToggle: () => void;
  labels: {
    addToFavorites: string;
    removeFromFavorites: string;
  };
  theme?: ThemeMode;
  primaryColor?: PrimaryColor;
}

export default function FavoriteButton({
  className = '',
  size = 'md',
  isFavorite,
  isLoaded,
  onToggle,
  labels,
  theme: themeProp,
  primaryColor = 'rose',
}: FavoriteButtonProps) {
  const { theme: contextTheme } = useSiteTheme();
  const theme = themeProp ?? contextTheme;

  if (!isLoaded) {
    return null;
  }

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggle();
  };

  const sizeClasses = {
    xs: 'w-6 h-6 p-1',
    sm: 'w-8 h-8 p-1.5',
    md: 'w-10 h-10 p-2',
    lg: 'w-12 h-12 p-2.5',
  };

  const iconSizes = {
    xs: 'h-3 w-3',
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  // テーマに応じたスタイル (Tailwindのsafelistを避けるため具体的なクラスを使用)
  const getButtonStyles = () => {
    if (theme === 'dark') {
      if (isFavorite) {
        return primaryColor === 'pink'
          ? 'bg-fuchsia-600 text-white hover:bg-fuchsia-700 hover:scale-105'
          : 'bg-fuchsia-600 text-white hover:bg-fuchsia-700 hover:scale-105';
      }
      return 'bg-gray-800/80 text-gray-300 hover:bg-gray-700 hover:text-white hover:scale-105';
    } else {
      if (isFavorite) {
        return primaryColor === 'pink'
          ? 'bg-pink-700 text-white hover:bg-pink-800 hover:scale-105'
          : 'bg-rose-700 text-white hover:bg-rose-800 hover:scale-105';
      }
      return primaryColor === 'pink'
        ? 'bg-white/90 text-gray-500 hover:bg-gray-100 hover:text-pink-700 hover:scale-105 border border-gray-200'
        : 'bg-white/90 text-gray-500 hover:bg-gray-100 hover:text-rose-700 hover:scale-105 border border-gray-200';
    }
  };

  return (
    <button
      onClick={handleClick}
      className={` ${sizeClasses[size]} rounded-full transition-all duration-200 active:scale-110 ${getButtonStyles()} flex items-center justify-center backdrop-blur-sm ${className} `}
      title={isFavorite ? labels.removeFromFavorites : labels.addToFavorites}
      aria-label={isFavorite ? labels.removeFromFavorites : labels.addToFavorites}
    >
      <Heart className={`${iconSizes[size]} ${isFavorite ? 'fill-current' : ''}`} />
    </button>
  );
}
