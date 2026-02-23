'use client';

import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';

export interface FavoriteItem {
  type: 'product' | 'actress';
  id: number | string;
  title?: string;
  name?: string;
  thumbnail?: string;
  image?: string;
  addedAt: number;
}

const STORAGE_KEY = 'adult-v-favorites';

export function useFavorites() {
  const [favorites, setFavorites] = useLocalStorage<FavoriteItem[]>(STORAGE_KEY, []);

  const addFavorite = useCallback(
    (item: Omit<FavoriteItem, 'addedAt'>) => {
      setFavorites((prev) => {
        const exists = prev.some((f) => f.type === item.type && f.id === item['id']);
        if (exists) return prev;

        return [
          {
            ...item,
            addedAt: Date.now(),
          },
          ...prev,
        ];
      });
    },
    [setFavorites],
  );

  const removeFavorite = useCallback(
    (type: 'product' | 'actress', id: number | string) => {
      setFavorites((prev) => prev.filter((f) => !(f.type === type && f.id === id)));
    },
    [setFavorites],
  );

  const isFavorite = useCallback(
    (type: 'product' | 'actress', id: number | string) => {
      return favorites.some((f) => f.type === type && f.id === id);
    },
    [favorites],
  );

  const toggleFavorite = useCallback(
    (item: Omit<FavoriteItem, 'addedAt'>) => {
      if (isFavorite(item.type, item['id'])) {
        removeFavorite(item.type, item['id']);
      } else {
        addFavorite(item);
      }
    },
    [isFavorite, removeFavorite, addFavorite],
  );

  const getFavoritesByType = useCallback(
    (type: 'product' | 'actress') => {
      return favorites.filter((f) => f.type === type);
    },
    [favorites],
  );

  const clearFavorites = useCallback(() => {
    setFavorites([]);
  }, [setFavorites]);

  return {
    favorites,
    isLoaded: true,
    addFavorite,
    removeFavorite,
    isFavorite,
    toggleFavorite,
    getFavoritesByType,
    clearFavorites,
    totalCount: favorites.length,
  };
}
