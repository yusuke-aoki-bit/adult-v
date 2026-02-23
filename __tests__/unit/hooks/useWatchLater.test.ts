/**
 * useWatchLaterフックのテスト
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { useWatchLater, useWatchLaterItem, type WatchLaterItem } from '@adult-v/shared/hooks/useWatchLater';

// FirebaseAuthContextのモック
vi.mock('@adult-v/shared/contexts/FirebaseAuthContext', () => ({
  useFirebaseAuth: () => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}));

// Firebase functionsのモック
vi.mock('@adult-v/shared/lib/firebase', () => ({
  saveWatchlistItemToFirestore: vi.fn(),
  removeWatchlistItemFromFirestore: vi.fn(),
  getWatchlistFromFirestore: vi.fn().mockResolvedValue([]),
}));

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

describe('useWatchLater', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', localStorageMock);
    localStorageMock.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('初期化', () => {
    it('空のlocalStorageから開始', () => {
      const { result } = renderHook(() => useWatchLater());

      expect(result.current.items).toEqual([]);
      expect(result.current.count).toBe(0);
      expect(result.current.isLoaded).toBe(true);
    });

    it('既存データをlocalStorageから読み込み', () => {
      const existingItems: WatchLaterItem[] = [
        { productId: '1', title: 'Product 1', addedAt: Date.now() },
        { productId: '2', title: 'Product 2', addedAt: Date.now() },
      ];
      localStorageMock.setItem('watch-later-list', JSON.stringify(existingItems));

      const { result } = renderHook(() => useWatchLater());

      expect(result.current.items).toHaveLength(2);
      expect(result.current.count).toBe(2);
    });

    it('無効なJSONでもエラーにならない', () => {
      localStorageMock.setItem('watch-later-list', 'invalid json');

      const { result } = renderHook(() => useWatchLater());

      expect(result.current.items).toEqual([]);
      expect(result.current.isLoaded).toBe(true);
    });
  });

  describe('addItem', () => {
    it('アイテムを追加', () => {
      const { result } = renderHook(() => useWatchLater());

      act(() => {
        result.current.addItem({
          productId: '123',
          title: 'Test Product',
          thumbnail: 'https://example.com/thumb.jpg',
          provider: 'fanza',
        });
      });

      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0]!.productId).toBe('123');
      expect(result.current.items[0]!.title).toBe('Test Product');
      expect(result.current.items[0]!.addedAt).toBeGreaterThan(0);
    });

    it('同じproductIdは重複追加しない', () => {
      const { result } = renderHook(() => useWatchLater());

      act(() => {
        result.current.addItem({ productId: '123', title: 'Product 1' });
      });

      act(() => {
        result.current.addItem({ productId: '123', title: 'Product 1 Updated' });
      });

      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0]!.title).toBe('Product 1'); // 更新されない
    });

    it('新しいアイテムは先頭に追加', () => {
      const { result } = renderHook(() => useWatchLater());

      act(() => {
        result.current.addItem({ productId: '1', title: 'First' });
      });

      act(() => {
        result.current.addItem({ productId: '2', title: 'Second' });
      });

      expect(result.current.items[0]!.productId).toBe('2');
      expect(result.current.items[1]!.productId).toBe('1');
    });

    it('最大100件を超えると古いものを削除', () => {
      const { result } = renderHook(() => useWatchLater());

      // 100件追加
      act(() => {
        for (let i = 0; i < 100; i++) {
          result.current.addItem({ productId: `id-${i}`, title: `Product ${i}` });
        }
      });

      expect(result.current.items).toHaveLength(100);

      // 101件目を追加
      act(() => {
        result.current.addItem({ productId: 'new-item', title: 'New Product' });
      });

      expect(result.current.items).toHaveLength(100);
      expect(result.current.items[0]!.productId).toBe('new-item');
      // 最後に追加したもの（id-0）が削除されている
      expect(result.current.items.find((i) => i.productId === 'id-0')).toBeUndefined();
    });

    it('localStorageに保存', () => {
      const { result } = renderHook(() => useWatchLater());

      act(() => {
        result.current.addItem({ productId: '123', title: 'Test' });
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith('watch-later-list', expect.stringContaining('123'));
    });
  });

  describe('removeItem', () => {
    it('アイテムを削除', () => {
      const { result } = renderHook(() => useWatchLater());

      act(() => {
        result.current.addItem({ productId: '1', title: 'Product 1' });
        result.current.addItem({ productId: '2', title: 'Product 2' });
      });

      act(() => {
        result.current.removeItem('1');
      });

      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0]!.productId).toBe('2');
    });

    it('存在しないIDを削除しても問題なし', () => {
      const { result } = renderHook(() => useWatchLater());

      act(() => {
        result.current.addItem({ productId: '1', title: 'Product 1' });
      });

      act(() => {
        result.current.removeItem('nonexistent');
      });

      expect(result.current.items).toHaveLength(1);
    });
  });

  describe('hasItem', () => {
    it('存在するアイテムをチェック', () => {
      const { result } = renderHook(() => useWatchLater());

      act(() => {
        result.current.addItem({ productId: '123', title: 'Test' });
      });

      expect(result.current.hasItem('123')).toBe(true);
      expect(result.current.hasItem('456')).toBe(false);
    });
  });

  describe('toggleItem', () => {
    it('存在しないアイテムを追加', () => {
      const { result } = renderHook(() => useWatchLater());

      act(() => {
        result.current.toggleItem({ productId: '123', title: 'Test' });
      });

      expect(result.current.items).toHaveLength(1);
    });

    it('存在するアイテムを削除', () => {
      const { result } = renderHook(() => useWatchLater());

      act(() => {
        result.current.addItem({ productId: '123', title: 'Test' });
      });

      act(() => {
        result.current.toggleItem({ productId: '123', title: 'Test' });
      });

      expect(result.current.items).toHaveLength(0);
    });
  });

  describe('clearAll', () => {
    it('全てのアイテムをクリア', () => {
      const { result } = renderHook(() => useWatchLater());

      act(() => {
        result.current.addItem({ productId: '1', title: 'Product 1' });
        result.current.addItem({ productId: '2', title: 'Product 2' });
      });

      act(() => {
        result.current.clearAll();
      });

      expect(result.current.items).toEqual([]);
      expect(result.current.count).toBe(0);
    });

    it('localStorageからも削除', () => {
      const { result } = renderHook(() => useWatchLater());

      act(() => {
        result.current.addItem({ productId: '1', title: 'Product 1' });
      });

      act(() => {
        result.current.clearAll();
      });

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('watch-later-list');
    });
  });
});

describe('useWatchLaterItem', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', localStorageMock);
    localStorageMock.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('アイテムがリストにあるかチェック', () => {
    // 事前にデータを設定
    const existingItems: WatchLaterItem[] = [{ productId: '123', title: 'Existing', addedAt: Date.now() }];
    localStorageMock.setItem('watch-later-list', JSON.stringify(existingItems));

    const { result } = renderHook(() => useWatchLaterItem('123'));

    expect(result.current.isInList).toBe(true);
    expect(result.current.isLoaded).toBe(true);
  });

  it('アイテムがリストにない場合', () => {
    const { result } = renderHook(() => useWatchLaterItem('nonexistent'));

    expect(result.current.isInList).toBe(false);
  });

  it('toggleでアイテムを追加/削除', () => {
    const { result } = renderHook(() => useWatchLaterItem('123'));

    act(() => {
      result.current.toggle({ title: 'New Item' });
    });

    expect(result.current.isInList).toBe(true);

    act(() => {
      result.current.toggle({ title: 'New Item' });
    });

    expect(result.current.isInList).toBe(false);
  });
});
