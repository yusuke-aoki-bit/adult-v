'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface FavoritesContextType {
  favoriteActresses: Set<number>;
  favoriteProducts: Set<string>;
  toggleActressFavorite: (actressId: number) => void;
  toggleProductFavorite: (productId: string) => void;
  isActressFavorite: (actressId: number) => boolean;
  isProductFavorite: (productId: string) => boolean;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favoriteActresses, setFavoriteActresses] = useState<Set<number>>(new Set());
  const [favoriteProducts, setFavoriteProducts] = useState<Set<string>>(new Set());
  const [isLoaded, setIsLoaded] = useState(false);

  // Load favorites from localStorage on mount
  useEffect(() => {
    const savedActresses = localStorage.getItem('favoriteActresses');
    const savedProducts = localStorage.getItem('favoriteProducts');

    if (savedActresses) {
      setFavoriteActresses(new Set(JSON.parse(savedActresses)));
    }
    if (savedProducts) {
      setFavoriteProducts(new Set(JSON.parse(savedProducts)));
    }
    setIsLoaded(true);
  }, []);

  // Save actresses to localStorage whenever they change
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('favoriteActresses', JSON.stringify(Array.from(favoriteActresses)));
    }
  }, [favoriteActresses, isLoaded]);

  // Save products to localStorage whenever they change
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('favoriteProducts', JSON.stringify(Array.from(favoriteProducts)));
    }
  }, [favoriteProducts, isLoaded]);

  const toggleActressFavorite = (actressId: number) => {
    setFavoriteActresses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(actressId)) {
        newSet.delete(actressId);
      } else {
        newSet.add(actressId);
      }
      return newSet;
    });
  };

  const toggleProductFavorite = (productId: string) => {
    setFavoriteProducts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const isActressFavorite = (actressId: number) => favoriteActresses.has(actressId);
  const isProductFavorite = (productId: string) => favoriteProducts.has(productId);

  return (
    <FavoritesContext.Provider
      value={{
        favoriteActresses,
        favoriteProducts,
        toggleActressFavorite,
        toggleProductFavorite,
        isActressFavorite,
        isProductFavorite,
      }}
    >
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
