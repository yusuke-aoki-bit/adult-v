'use client';

import { useCallback, useMemo } from 'react';
import { useLocalStorage } from './useLocalStorage';

export interface CompareItemBase {
  id: string | number;
  addedAt: number;
}

type AddItemInput<T> = Omit<T, 'addedAt'> & { id: string | number };

/**
 * 比較リストhookのジェネリックファクトリ
 *
 * useCompareList / usePerformerCompareList の重複を排除し、
 * useLocalStorage ベースのクロスタブ同期を提供する。
 */
export function createCompareListHook<T extends CompareItemBase>(
  storageKey: string,
  maxItems: number = 4,
) {
  const defaultValue: T[] = [];

  return function useCompareListInstance() {
    const [items, setItems] = useLocalStorage<T[]>(storageKey, defaultValue);

    const compareSet = useMemo(
      () => new Set(items.map((i) => String(i.id))),
      [items],
    );

    const addItem = useCallback(
      (item: AddItemInput<T>) => {
        setItems((prev) => {
          if (prev.some((i) => String(i.id) === String(item.id))) return prev;
          return [{ ...item, addedAt: Date.now() } as T, ...prev].slice(0, maxItems);
        });
      },
      [setItems],
    );

    const removeItem = useCallback(
      (id: string | number) => {
        setItems((prev) => prev.filter((i) => String(i.id) !== String(id)));
      },
      [setItems],
    );

    const clearAll = useCallback(() => {
      setItems(defaultValue);
    }, [setItems]);

    const isInCompareList = useCallback(
      (id: string | number) => compareSet.has(String(id)),
      [compareSet],
    );

    const toggleItem = useCallback(
      (item: AddItemInput<T>) => {
        if (compareSet.has(String(item.id))) {
          removeItem(item.id);
        } else {
          addItem(item);
        }
      },
      [compareSet, addItem, removeItem],
    );

    return {
      items,
      addItem,
      removeItem,
      clearAll,
      isInCompareList,
      toggleItem,
      compareSet,
      isFull: items.length >= maxItems,
      count: items.length,
      maxItems,
    };
  };
}
