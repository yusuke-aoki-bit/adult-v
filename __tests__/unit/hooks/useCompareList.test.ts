/**
 * useCompareListフックのテスト
 * 商品比較リスト機能のテスト
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCompareList, type CompareItem } from '@adult-v/shared/hooks/useCompareList';

// localStorageのモック
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
  };
})();

describe('useCompareList', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', localStorageMock);
    localStorageMock.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('初期化', () => {
    it('空のlocalStorageから開始', () => {
      const { result } = renderHook(() => useCompareList());

      expect(result.current.items).toEqual([]);
      expect(result.current.count).toBe(0);
    });

    it('既存データをlocalStorageから読み込み', async () => {
      const existingItems: CompareItem[] = [
        { id: '1', title: 'Product 1', addedAt: Date.now() },
        { id: '2', title: 'Product 2', addedAt: Date.now() },
      ];
      localStorageMock.setItem('product_compare_list', JSON.stringify(existingItems));

      const { result } = renderHook(() => useCompareList());

      await waitFor(() => {
        expect(result.current.items).toHaveLength(2);
      });
    });

    it('無効なJSONでもエラーにならない', () => {
      localStorageMock.setItem('product_compare_list', 'invalid json');

      const { result } = renderHook(() => useCompareList());

      expect(result.current.items).toEqual([]);
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

      act(() => {
        for (let i = 0; i < 5; i++) {
          result.current.addItem({ id: `id-${i}`, title: `Product ${i}` });
        }
      });

      expect(result.current.items).toHaveLength(4);
      expect(result.current.isFull).toBe(true);
    });

    it('localStorageに保存', () => {
      const { result } = renderHook(() => useCompareList());

      act(() => {
        result.current.addItem({ id: '123', title: 'Test' });
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'product_compare_list',
        expect.stringContaining('123')
      );
    });
  });

  describe('removeItem', () => {
    it('アイテムを削除', () => {
      const { result } = renderHook(() => useCompareList());

      act(() => {
        result.current.addItem({ id: '1', title: 'Product 1' });
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

      // isInCompareListはitemsに基づいているのでactの中で追加した後すぐチェック可能
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

      act(() => {
        result.current.addItem({ id: 'id-0', title: 'Product 0' });
      });
      act(() => {
        result.current.addItem({ id: 'id-1', title: 'Product 1' });
      });
      act(() => {
        result.current.addItem({ id: 'id-2', title: 'Product 2' });
      });
      act(() => {
        result.current.addItem({ id: 'id-3', title: 'Product 3' });
      });

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
