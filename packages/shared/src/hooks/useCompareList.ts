'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

const STORAGE_KEY = 'product_compare_list';
const MAX_COMPARE_ITEMS = 4;

export interface CompareItem {
  id: string | number;
  title: string;
  imageUrl?: string | null;
  addedAt: number;
}

// LocalStorageの変更を購読するためのヘルパー
function getStoredItems(): CompareItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (e) {
    console.error('Failed to load compare list:', e);
  }
  return [];
}

// カスタムイベントでコンポーネント間の同期を行う
const COMPARE_LIST_UPDATED_EVENT = 'compare-list-updated';

function dispatchCompareListUpdate() {
  if (typeof window !== 'undefined') {
    // 次のフレームでイベントを発火（レンダリング中のsetState呼び出しを防ぐ）
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent(COMPARE_LIST_UPDATED_EVENT));
    }, 0);
  }
}

export function useCompareList() {
  const [items, setItems] = useState<CompareItem[]>([]);

  // 初回読み込み + storageイベント + カスタムイベントでの同期
  useEffect(() => {
    // 初回読み込み
    setItems(getStoredItems());

    // 他のタブからのstorage変更を検知
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setItems(getStoredItems());
      }
    };

    // 同一タブ内の変更を検知（カスタムイベント）
    const handleCompareListUpdate = () => {
      setItems(getStoredItems());
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener(COMPARE_LIST_UPDATED_EVENT, handleCompareListUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener(COMPARE_LIST_UPDATED_EVENT, handleCompareListUpdate);
    };
  }, []);

  // LocalStorageに保存し、他のコンポーネントに通知
  const saveToStorage = useCallback((newItems: CompareItem[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newItems));
      // 同一タブ内の他のコンポーネントに変更を通知
      dispatchCompareListUpdate();
    } catch (e) {
      console.error('Failed to save compare list:', e);
    }
  }, []);

  const addItem = useCallback((item: Omit<CompareItem, 'addedAt'>) => {
    setItems(prev => {
      // 既に存在する場合は追加しない
      if (prev.some(i => String(i.id) === String(item['id']))) {
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

  // O(1) で比較リストに含まれているかをチェックするための Set
  // パフォーマンス最適化: 毎回 items.some() を呼ぶ代わりに Set.has() を使用
  const compareSet = useMemo(() => {
    return new Set(items.map(i => String(i.id)));
  }, [items]);

  const isInCompareList = useCallback((id: string | number) => {
    return compareSet.has(String(id));
  }, [compareSet]);

  const toggleItem = useCallback((item: Omit<CompareItem, 'addedAt'>) => {
    if (compareSet.has(String(item['id']))) {
      removeItem(item['id']);
    } else {
      addItem(item);
    }
  }, [compareSet, addItem, removeItem]);

  return {
    items,
    addItem,
    removeItem,
    clearAll,
    isInCompareList,
    toggleItem,
    compareSet,
    isFull: items.length >= MAX_COMPARE_ITEMS,
    count: items.length,
    maxItems: MAX_COMPARE_ITEMS,
  };
}

export default useCompareList;
