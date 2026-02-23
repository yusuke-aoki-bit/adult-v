/**
 * useCompareListフックのテスト
 * 商品比較リスト機能のテスト
 *
 * useLocalStorage (useSyncExternalStore ベース) をモックし、
 * useState で代替することでテスト環境での動作を保証
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useState } from 'react';

// useLocalStorageをuseStateベースにモック（useSyncExternalStoreはjsdomで不安定）
vi.mock('@adult-v/shared/hooks/useLocalStorage', () => ({
  useLocalStorage: <T>(_key: string, defaultValue: T): [T, (v: T | ((prev: T) => T)) => void] => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useState<T>(defaultValue);
  },
}));

import { useCompareList, type CompareItem } from '@adult-v/shared/hooks/useCompareList';

describe('useCompareList', () => {
  describe('初期化', () => {
    it('空の状態から開始', () => {
      const { result } = renderHook(() => useCompareList());

      expect(result.current.items).toEqual([]);
      expect(result.current.count).toBe(0);
    });
  });

  describe('addItem', () => {
    it('アイテムを追加', () => {
      const { result } = renderHook(() => useCompareList());

      act(() => {
        result.current.addItem({
          id: '123',
          title: 'Test Product',
          imageUrl: 'https://example.com/thumb.jpg',
        });
      });

      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0]!.id).toBe('123');
      expect(result.current.items[0]!.title).toBe('Test Product');
    });

    it('同じIDは重複追加しない', () => {
      const { result } = renderHook(() => useCompareList());

      act(() => {
        result.current.addItem({ id: '123', title: 'Product 1' });
      });

      act(() => {
        result.current.addItem({ id: '123', title: 'Product 1 Updated' });
      });

      expect(result.current.items).toHaveLength(1);
    });

    it('最大4件まで追加可能（古いものは削除）', () => {
      const { result } = renderHook(() => useCompareList());

      for (let i = 0; i < 5; i++) {
        act(() => {
          result.current.addItem({ id: `id-${i}`, title: `Product ${i}` });
        });
      }

      expect(result.current.items).toHaveLength(4);
      expect(result.current.isFull).toBe(true);
    });
  });

  describe('removeItem', () => {
    it('アイテムを削除', () => {
      const { result } = renderHook(() => useCompareList());

      act(() => {
        result.current.addItem({ id: '1', title: 'Product 1' });
      });
      act(() => {
        result.current.addItem({ id: '2', title: 'Product 2' });
      });

      act(() => {
        result.current.removeItem('1');
      });

      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0]!.id).toBe('2');
    });

    it('存在しないIDを削除しても問題なし', () => {
      const { result } = renderHook(() => useCompareList());

      act(() => {
        result.current.addItem({ id: '1', title: 'Product 1' });
      });

      act(() => {
        result.current.removeItem('nonexistent');
      });

      expect(result.current.items).toHaveLength(1);
    });
  });

  describe('toggleItem', () => {
    it('存在しないアイテムを追加', () => {
      const { result } = renderHook(() => useCompareList());

      act(() => {
        result.current.toggleItem({ id: '123', title: 'Test' });
      });

      expect(result.current.items).toHaveLength(1);
    });

    it('存在するアイテムを削除', () => {
      const { result } = renderHook(() => useCompareList());

      act(() => {
        result.current.addItem({ id: '123', title: 'Test' });
      });

      act(() => {
        result.current.toggleItem({ id: '123', title: 'Test' });
      });

      expect(result.current.items).toHaveLength(0);
    });
  });

  describe('isInCompareList', () => {
    it('存在するアイテムをチェック', () => {
      const { result } = renderHook(() => useCompareList());

      act(() => {
        result.current.addItem({ id: '123', title: 'Test' });
      });

      expect(result.current.items.length).toBe(1);
      expect(result.current.isInCompareList('123')).toBe(true);
      expect(result.current.isInCompareList('456')).toBe(false);
    });
  });

  describe('clearAll', () => {
    it('全てのアイテムをクリア', () => {
      const { result } = renderHook(() => useCompareList());

      act(() => {
        result.current.addItem({ id: '1', title: 'Product 1' });
      });
      act(() => {
        result.current.addItem({ id: '2', title: 'Product 2' });
      });

      act(() => {
        result.current.clearAll();
      });

      expect(result.current.items).toEqual([]);
      expect(result.current.count).toBe(0);
    });
  });

  describe('isFull', () => {
    it('4件未満ではfalse', () => {
      const { result } = renderHook(() => useCompareList());

      act(() => {
        result.current.addItem({ id: '1', title: 'Product 1' });
      });

      expect(result.current.isFull).toBe(false);
    });

    it('4件でtrue', () => {
      const { result } = renderHook(() => useCompareList());

      for (let i = 0; i < 4; i++) {
        act(() => {
          result.current.addItem({ id: `id-${i}`, title: `Product ${i}` });
        });
      }

      expect(result.current.items.length).toBe(4);
      expect(result.current.isFull).toBe(true);
    });
  });

  describe('maxItems', () => {
    it('maxItemsが4を返す', () => {
      const { result } = renderHook(() => useCompareList());

      expect(result.current.maxItems).toBe(4);
    });
  });
});
