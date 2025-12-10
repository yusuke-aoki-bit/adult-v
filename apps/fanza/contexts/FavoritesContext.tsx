'use client';

import React, { createContext, useContext, useSyncExternalStore, ReactNode, useCallback, useMemo } from 'react';

interface FavoritesContextType {
  favoriteActresses: Set<number>;
  favoriteProducts: Set<string>;
  toggleActressFavorite: (actressId: number) => void;
  toggleProductFavorite: (productId: string) => void;
  isActressFavorite: (actressId: number) => boolean;
  isProductFavorite: (productId: string) => boolean;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

// Custom hook to sync with localStorage using useSyncExternalStore
function useLocalStorageValue(key: string): string {
  const subscribe = useCallback((callback: () => void) => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key || e.key === null) {
        callback();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('local-storage-update', callback);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('local-storage-update', callback);
    };
  }, [key]);

  const getSnapshot = useCallback(() => {
    return localStorage.getItem(key) || '[]';
  }, [key]);

  const getServerSnapshot = useCallback(() => '[]', []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const actressesRaw = useLocalStorageValue('favoriteActresses');
  const productsRaw = useLocalStorageValue('favoriteProducts');

  const favoriteActresses = useMemo(() => {
    try {
      return new Set<number>(JSON.parse(actressesRaw));
    } catch {
      return new Set<number>();
    }
  }, [actressesRaw]);

  const favoriteProducts = useMemo(() => {
    try {
      return new Set<string>(JSON.parse(productsRaw));
    } catch {
      return new Set<string>();
    }
  }, [productsRaw]);

  const toggleActressFavorite = useCallback((actressId: number) => {
    const current = new Set(favoriteActresses);
    if (current.has(actressId)) {
      current.delete(actressId);
    } else {
      current.add(actressId);
    }
    localStorage.setItem('favoriteActresses', JSON.stringify(Array.from(current)));
    window.dispatchEvent(new Event('local-storage-update'));
  }, [favoriteActresses]);

  const toggleProductFavorite = useCallback((productId: string) => {
    const current = new Set(favoriteProducts);
    if (current.has(productId)) {
      current.delete(productId);
    } else {
      current.add(productId);
    }
    localStorage.setItem('favoriteProducts', JSON.stringify(Array.from(current)));
    window.dispatchEvent(new Event('local-storage-update'));
  }, [favoriteProducts]);

  const isActressFavorite = useCallback((actressId: number) => favoriteActresses.has(actressId), [favoriteActresses]);
  const isProductFavorite = useCallback((productId: string) => favoriteProducts.has(productId), [favoriteProducts]);

  const value = useMemo(() => ({
    favoriteActresses,
    favoriteProducts,
    toggleActressFavorite,
    toggleProductFavorite,
    isActressFavorite,
    isProductFavorite,
  }), [favoriteActresses, favoriteProducts, toggleActressFavorite, toggleProductFavorite, isActressFavorite, isProductFavorite]);

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (context === undefined) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return context;
}
