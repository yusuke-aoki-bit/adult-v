'use client';

import { useState, useCallback } from 'react';

export interface BulkSelectionState {
  selectedItems: Set<string>;
  isSelectionMode: boolean;
}

export interface UseBulkSelectionOptions {
  maxItems?: number;
  onSelectionChange?: (selectedIds: string[]) => void;
}

export interface UseBulkSelectionReturn {
  selectedItems: string[];
  selectedCount: number;
  isSelectionMode: boolean;
  isSelected: (id: string) => boolean;
  toggleItem: (id: string) => void;
  selectItem: (id: string) => void;
  deselectItem: (id: string) => void;
  selectAll: (ids: string[]) => void;
  deselectAll: () => void;
  toggleSelectionMode: () => void;
  enableSelectionMode: () => void;
  disableSelectionMode: () => void;
}

export function useBulkSelection(options: UseBulkSelectionOptions = {}): UseBulkSelectionReturn {
  const { maxItems = 50, onSelectionChange } = options;

  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const notifyChange = useCallback(
    (items: Set<string>) => {
      if (onSelectionChange) {
        onSelectionChange(Array.from(items));
      }
    },
    [onSelectionChange],
  );

  const isSelected = useCallback(
    (id: string) => {
      return selectedItems.has(id);
    },
    [selectedItems],
  );

  const toggleItem = useCallback(
    (id: string) => {
      setSelectedItems((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else if (next.size < maxItems) {
          next.add(id);
        }
        notifyChange(next);
        return next;
      });
    },
    [maxItems, notifyChange],
  );

  const selectItem = useCallback(
    (id: string) => {
      setSelectedItems((prev) => {
        if (prev.has(id) || prev.size >= maxItems) return prev;
        const next = new Set(prev);
        next.add(id);
        notifyChange(next);
        return next;
      });
    },
    [maxItems, notifyChange],
  );

  const deselectItem = useCallback(
    (id: string) => {
      setSelectedItems((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        notifyChange(next);
        return next;
      });
    },
    [notifyChange],
  );

  const selectAll = useCallback(
    (ids: string[]) => {
      setSelectedItems((prev) => {
        const next = new Set(prev);
        for (const id of ids) {
          if (next.size >= maxItems) break;
          next.add(id);
        }
        notifyChange(next);
        return next;
      });
    },
    [maxItems, notifyChange],
  );

  const deselectAll = useCallback(() => {
    setSelectedItems(new Set());
    notifyChange(new Set());
  }, [notifyChange]);

  const toggleSelectionMode = useCallback(() => {
    setIsSelectionMode((prev) => {
      if (prev) {
        // 選択モード解除時にクリア
        setSelectedItems(new Set());
        notifyChange(new Set());
      }
      return !prev;
    });
  }, [notifyChange]);

  const enableSelectionMode = useCallback(() => {
    setIsSelectionMode(true);
  }, []);

  const disableSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedItems(new Set());
    notifyChange(new Set());
  }, [notifyChange]);

  return {
    selectedItems: Array.from(selectedItems),
    selectedCount: selectedItems.size,
    isSelectionMode,
    isSelected,
    toggleItem,
    selectItem,
    deselectItem,
    selectAll,
    deselectAll,
    toggleSelectionMode,
    enableSelectionMode,
    disableSelectionMode,
  };
}
