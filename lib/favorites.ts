'use client';

/**
 * お気に入り管理用のユーティリティ
 */

export function getFavorites(): string[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const favorites = localStorage.getItem('favorites');
    return favorites ? JSON.parse(favorites) : [];
  } catch (error) {
    console.error('Error reading favorites:', error);
    return [];
  }
}

export function addFavorite(productId: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const favorites = getFavorites();
    if (!favorites.includes(productId)) {
      favorites.push(productId);
      localStorage.setItem('favorites', JSON.stringify(favorites));
      window.dispatchEvent(new Event('favorites-updated'));
    }
  } catch (error) {
    console.error('Error adding favorite:', error);
  }
}

export function removeFavorite(productId: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const favorites = getFavorites();
    const filtered = favorites.filter((id) => id !== productId);
    localStorage.setItem('favorites', JSON.stringify(filtered));
    window.dispatchEvent(new Event('favorites-updated'));
  } catch (error) {
    console.error('Error removing favorite:', error);
  }
}

export function isFavorite(productId: string): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const favorites = getFavorites();
  return favorites.includes(productId);
}

export function toggleFavorite(productId: string): boolean {
  if (isFavorite(productId)) {
    removeFavorite(productId);
    return false;
  } else {
    addFavorite(productId);
    return true;
  }
}

