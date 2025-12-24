'use client';

import { useState, useEffect } from 'react';

export interface WatchLaterItem {
  id: number | string;
  title: string;
  thumbnail?: string;
  provider?: string;
  addedAt: number;
}

const STORAGE_KEY = 'adult-v-watch-later';
const MAX_ITEMS = 100; // Maximum items to store

export function useWatchLater() {
  const [items, setItems] = useState<WatchLaterItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load items from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as WatchLaterItem[];
        setItems(parsed);
      }
    } catch (error) {
      console.error('Failed to load watch later items:', error);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save items to localStorage whenever they change
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      } catch (error) {
        console.error('Failed to save watch later items:', error);
      }
    }
  }, [items, isLoaded]);

  const addItem = (item: Omit<WatchLaterItem, 'addedAt'>) => {
    setItems((prev) => {
      // Check if already exists
      const exists = prev.some((i) => String(i.id) === String(item.id));
      if (exists) return prev;

      // Add new item at the beginning, limit to MAX_ITEMS
      const newItems = [
        {
          ...item,
          addedAt: Date.now(),
        },
        ...prev,
      ].slice(0, MAX_ITEMS);

      return newItems;
    });
  };

  const removeItem = (id: number | string) => {
    setItems((prev) => prev.filter((i) => String(i.id) !== String(id)));
  };

  const isInWatchLater = (id: number | string) => {
    return items.some((i) => String(i.id) === String(id));
  };

  const toggleWatchLater = (item: Omit<WatchLaterItem, 'addedAt'>) => {
    if (isInWatchLater(item.id)) {
      removeItem(item.id);
    } else {
      addItem(item);
    }
  };

  const clearAll = () => {
    setItems([]);
  };

  return {
    items,
    isLoaded,
    addItem,
    removeItem,
    isInWatchLater,
    toggleWatchLater,
    clearAll,
    totalCount: items.length,
  };
}
