/**
 * useHomeSectionsフックのテスト
 * ホーム画面セクション管理機能のテスト
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useHomeSections } from '@adult-v/shared/hooks/useHomeSections';

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

describe('useHomeSections', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', localStorageMock);
    localStorageMock.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('初期化', () => {
    it('デフォルトセクションで開始', async () => {
      const { result } = renderHook(() => useHomeSections('ja'));

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      expect(result.current.sections).toHaveLength(8);
      expect(result.current.sections[0].id).toBe('sale'); // 最初のセクションは'sale'
    });

    it('既存の設定をlocalStorageから読み込み', async () => {
      const customSections = [
        { id: 'trending', visible: false, order: 0 },
        { id: 'sales', visible: true, order: 1 },
      ];
      localStorageMock.setItem('section_preferences_home', JSON.stringify(customSections));

      const { result } = renderHook(() => useHomeSections('ja'));

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      const trending = result.current.sections.find(s => s.id === 'trending');
      expect(trending?.visible).toBe(false);
    });

    it('無効なJSONでもエラーにならずデフォルト使用', async () => {
      localStorageMock.setItem('section_preferences_home', 'invalid json');

      const { result } = renderHook(() => useHomeSections('ja'));

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      expect(result.current.sections).toHaveLength(8);
    });

    it('英語ロケールでは英語ラベルを使用', async () => {
      const { result } = renderHook(() => useHomeSections('en'));

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      const saleSection = result.current.sections.find(s => s.id === 'sale');
      expect(saleSection?.label).toBe('On Sale');
    });
  });

  describe('toggleVisibility', () => {
    it('セクションの表示/非表示を切り替え', async () => {
      const { result } = renderHook(() => useHomeSections('ja'));

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      const initialVisibility = result.current.sections.find(s => s.id === 'trending')?.visible;

      act(() => {
        result.current.toggleVisibility('trending');
      });

      const newVisibility = result.current.sections.find(s => s.id === 'trending')?.visible;
      expect(newVisibility).toBe(!initialVisibility);
    });

    it('localStorageに保存される', async () => {
      const { result } = renderHook(() => useHomeSections('ja'));

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      act(() => {
        result.current.toggleVisibility('trending');
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'section_preferences_home',
        expect.any(String)
      );
    });
  });

  describe('reorderSections', () => {
    it('セクションの順序を変更', async () => {
      const { result } = renderHook(() => useHomeSections('ja'));

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      const originalFirstId = result.current.sections[0].id;

      act(() => {
        result.current.reorderSections(0, 2);
      });

      // 最初の要素が移動したことを確認
      expect(result.current.sections[0].id).not.toBe(originalFirstId);
    });

    it('orderプロパティが更新される', async () => {
      const { result } = renderHook(() => useHomeSections('ja'));

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      act(() => {
        result.current.reorderSections(0, 2);
      });

      result.current.sections.forEach((section, index) => {
        expect(section.order).toBe(index);
      });
    });
  });

  describe('resetToDefault', () => {
    it('デフォルト設定にリセット', async () => {
      const { result } = renderHook(() => useHomeSections('ja'));

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      // カスタマイズ
      act(() => {
        result.current.toggleVisibility('trending');
        result.current.reorderSections(0, 3);
      });

      // リセット
      act(() => {
        result.current.resetToDefault();
      });

      // デフォルトの順序に戻っていることを確認
      expect(result.current.sections[0].id).toBe('sale');
      const trending = result.current.sections.find(s => s.id === 'trending');
      expect(trending?.visible).toBe(true);
    });
  });

  describe('visibleSections', () => {
    it('表示中のセクションのみ返す', async () => {
      const { result } = renderHook(() => useHomeSections('ja'));

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      // 1つを非表示に
      act(() => {
        result.current.toggleVisibility('trending');
      });

      const visibleIds = result.current.visibleSections.map(s => s.id);
      expect(visibleIds).not.toContain('trending');
    });

    it('orderでソートされている', async () => {
      const { result } = renderHook(() => useHomeSections('ja'));

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      // 順序を変更
      act(() => {
        result.current.reorderSections(0, 2);
      });

      const visible = result.current.visibleSections;
      for (let i = 0; i < visible.length - 1; i++) {
        expect(visible[i].order).toBeLessThan(visible[i + 1].order);
      }
    });
  });

  describe('isSectionVisible', () => {
    it('表示中セクションでtrue', async () => {
      const { result } = renderHook(() => useHomeSections('ja'));

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      // デフォルトで表示中のセクション
      expect(result.current.isSectionVisible('sales')).toBe(true);
    });

    it('非表示セクションでfalse', async () => {
      const { result } = renderHook(() => useHomeSections('ja'));

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      act(() => {
        result.current.toggleVisibility('trending');
      });

      expect(result.current.isSectionVisible('trending')).toBe(false);
    });
  });

  describe('getSectionOrder', () => {
    it('セクションのorderを取得', async () => {
      const { result } = renderHook(() => useHomeSections('ja'));

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      expect(result.current.getSectionOrder('sale')).toBe(0);
      expect(result.current.getSectionOrder('trending')).toBe(4);
    });

    it('存在しないセクションで0を返す', async () => {
      const { result } = renderHook(() => useHomeSections('ja'));

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      expect(result.current.getSectionOrder('nonexistent')).toBe(0);
    });
  });
});
