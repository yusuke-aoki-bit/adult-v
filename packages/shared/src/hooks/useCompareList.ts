'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'product_compare_list';
const MAX_COMPARE_ITEMS = 4;

export interface CompareItem {
  id: string | number;
  title: string;
  imageUrl?: string | null;
  addedAt: number;
}

export function useCompareList() {
  const [items, setItems] = useState<CompareItem[]>([]);

  // LocalStorageから読み込み
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setItems(Array.isArray(parsed) ? parsed : []);
      }
    } catch (e) {
      console.error('Failed to load compare list:', e);
    }
  }, []);

  // LocalStorageに保存
  const saveToStorage = useCallback((newItems: CompareItem[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newItems));
    } catch (e) {
      console.error('Failed to save compare list:', e);
    }
  }, []);

  const addItem = useCallback((item: Omit<CompareItem, 'addedAt'>) => {
    setItems(prev => {
      // 既に存在する場合は追加しない
      if (prev.some(i => String(i.id) === String(item.id))) {
        return prev;
      }

      // 最大数を超える場合は最も古いものを削除
      const newItems = [
        { ...item, addedAt: Date.now() },
        ...prev,
      ].slice(0, MAX_COMPARE_ITEMS);

      saveToStorage(newItems);
      return newItems;
    });
  }, [saveToStorage]);

  const removeItem = useCallback((id: string | number) => {
    setItems(prev => {
      const newItems = prev.filter(i => String(i.id) !== String(id));
      saveToStorage(newItems);
      return newItems;
    });
  }, [saveToStorage]);

  const clearAll = useCallback(() => {
    setItems([]);
    saveToStorage([]);
  }, [saveToStorage]);

  const isInCompareList = useCallback((id: string | number) => {
    return items.some(i => String(i.id) === String(id));
  }, [items]);

  const toggleItem = useCallback((item: Omit<CompareItem, 'addedAt'>) => {
    if (isInCompareList(item.id)) {
      removeItem(item.id);
    } else {
      addItem(item);
    }
  }, [isInCompareList, addItem, removeItem]);

  return {
    items,
    addItem,
    removeItem,
    clearAll,
    isInCompareList,
    toggleItem,
    isFull: items.length >= MAX_COMPARE_ITEMS,
    count: items.length,
    maxItems: MAX_COMPARE_ITEMS,
  };
}

export default useCompareList;
