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
    if (!favorites) {
      return [];
    }

    const parsed = JSON.parse(favorites);

    // Validate that parsed data is an array of strings
    if (!Array.isArray(parsed)) {
      console.error('Invalid favorites data: not an array');
      localStorage.removeItem('favorites');
      return [];
    }

    // Filter out any non-string values
    const validated = parsed.filter((item): item is string => typeof item === 'string');

    // If we had to filter out invalid items, update localStorage
    if (validated.length !== parsed.length) {
      localStorage.setItem('favorites', JSON.stringify(validated));
    }

    return validated;
  } catch (error) {
    console.error('Error reading favorites:', error);
    // Clear corrupted data
    try {
      localStorage.removeItem('favorites');
    } catch {
      // Ignore removal errors
    }
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

