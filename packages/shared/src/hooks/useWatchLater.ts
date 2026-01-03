'use client';

import { useState, useEffect, useCallback } from 'react';

export interface WatchLaterItem {
  productId: string;
  title: string;
  thumbnail?: string;
  provider?: string;
  addedAt: number;
}

const STORAGE_KEY = 'watch-later-list';
const MAX_ITEMS = 100;

/**
 * 後で見るリストを管理するフック
 */
export function useWatchLater() {
  const [items, setItems] = useState<WatchLaterItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // localStorageから読み込み
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as WatchLaterItem[];
        setItems(parsed);
      }
    } catch (error) {
      console.error('[useWatchLater] Failed to load:', error);
    }
    setIsLoaded(true);
  }, []);

  // localStorageに保存
  const saveItems = useCallback((newItems: WatchLaterItem[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newItems));
    } catch (error) {
      console.error('[useWatchLater] Failed to save:', error);
    }
  }, []);

  // アイテムを追加
  const addItem = useCallback((item: Omit<WatchLaterItem, 'addedAt'>) => {
    setItems(prev => {
      // 既に存在する場合は追加しない
      if (prev.some(i => i.productId === item.productId)) {
        return prev;
      }

      const newItem: WatchLaterItem = {
        ...item,
        addedAt: Date.now(),
      };

      // 最大件数を超える場合は古いものを削除
      const newItems = [newItem, ...prev].slice(0, MAX_ITEMS);
      saveItems(newItems);
      return newItems;
    });
  }, [saveItems]);

  // アイテムを削除
  const removeItem = useCallback((productId: string) => {
    setItems(prev => {
      const newItems = prev.filter(i => i.productId !== productId);
      saveItems(newItems);
      return newItems;
    });
  }, [saveItems]);

  // アイテムが存在するかチェック
  const hasItem = useCallback((productId: string) => {
    return items.some(i => i.productId === productId);
  }, [items]);

  // トグル（追加/削除）
  const toggleItem = useCallback((item: Omit<WatchLaterItem, 'addedAt'>) => {
    if (hasItem(item.productId)) {
      removeItem(item.productId);
    } else {
      addItem(item);
    }
  }, [hasItem, addItem, removeItem]);

  // すべてクリア
  const clearAll = useCallback(() => {
    setItems([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('[useWatchLater] Failed to clear:', error);
    }
  }, []);

  return {
    items,
    isLoaded,
    addItem,
    removeItem,
    hasItem,
    toggleItem,
    clearAll,
    count: items.length,
  };
}

/**
 * 単一作品用のシンプルなフック
 */
export function useWatchLaterItem(productId: string) {
  const { hasItem, toggleItem, isLoaded } = useWatchLater();

  const isInList = hasItem(productId);

  const toggle = useCallback((item: Omit<WatchLaterItem, 'addedAt' | 'productId'>) => {
    toggleItem({ ...item, productId });
  }, [toggleItem, productId]);

  return {
    isInList,
    isLoaded,
    toggle,
  };
}
