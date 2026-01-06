'use client';

import { useState, useEffect, useCallback } from 'react';

export interface RecentlyViewedItem {
  id: string;
  title: string;
  imageUrl: string | null;
  aspName: string;
  viewedAt: number;
}

const STORAGE_KEY = 'recently_viewed_products';
const MAX_ITEMS = 20;

export function useRecentlyViewed() {
  const [items, setItems] = useState<RecentlyViewedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ローカルストレージから読み込み
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as RecentlyViewedItem[];
        setItems(parsed);
      }
    } catch (error) {
      console.error('Failed to load recently viewed items:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // アイテムを追加
  const addItem = useCallback((item: Omit<RecentlyViewedItem, 'viewedAt'>) => {
    setItems((prev) => {
      // 既存のアイテムを除外
      const filtered = prev.filter((i) => i.id !== item['id']);

      // 新しいアイテムを先頭に追加
      const newItem: RecentlyViewedItem = {
        ...item,
        viewedAt: Date.now(),
      };

      const updated = [newItem, ...filtered].slice(0, MAX_ITEMS);

      // ローカルストレージに保存
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error('Failed to save recently viewed items:', error);
      }

      return updated;
    });
  }, []);

  // アイテムを削除
  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const updated = prev.filter((i) => i.id !== id);

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error('Failed to remove recently viewed item:', error);
      }

      return updated;
    });
  }, []);

  // 全件クリア
  const clearAll = useCallback(() => {
    setItems([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear recently viewed items:', error);
    }
  }, []);

  return {
    items,
    isLoading,
    addItem,
    removeItem,
    clearAll,
  };
}
