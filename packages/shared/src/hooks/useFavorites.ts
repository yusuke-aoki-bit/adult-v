'use client';

import { useState, useEffect, useCallback } from 'react';

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
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load favorites from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as FavoriteItem[];
        setFavorites(parsed);
      }
    } catch (error) {
      console.error('Failed to load favorites:', error);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save favorites to localStorage whenever they change
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
      } catch (error) {
        console.error('Failed to save favorites:', error);
      }
    }
  }, [favorites, isLoaded]);

  const addFavorite = (item: Omit<FavoriteItem, 'addedAt'>) => {
    setFavorites((prev) => {
      // Check if already exists
      const exists = prev.some(
        (f) => f.type === item.type && f.id === item['id']
      );
      if (exists) return prev;

      return [
        {
          ...item,
          addedAt: Date.now(),
        },
        ...prev,
      ];
    });
  };

  const removeFavorite = (type: 'product' | 'actress', id: number | string) => {
    setFavorites((prev) =>
      prev.filter((f) => !(f.type === type && f.id === id))
    );
  };

  const isFavorite = (type: 'product' | 'actress', id: number | string) => {
    return favorites.some((f) => f.type === type && f.id === id);
  };

  const toggleFavorite = (item: Omit<FavoriteItem, 'addedAt'>) => {
    if (isFavorite(item.type, item['id'])) {
      removeFavorite(item.type, item['id']);
    } else {
      addFavorite(item);
    }
  };

  const getFavoritesByType = useCallback((type: 'product' | 'actress') => {
    return favorites.filter((f) => f.type === type);
  }, [favorites]);

  const clearFavorites = () => {
    setFavorites([]);
  };

  return {
    favorites,
    isLoaded,
    addFavorite,
    removeFavorite,
    isFavorite,
    toggleFavorite,
    getFavoritesByType,
    clearFavorites,
    totalCount: favorites.length,
  };
}
