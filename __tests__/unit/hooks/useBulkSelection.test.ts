/**
 * useBulkSelectionフックのテスト
 * 一括選択機能のテスト
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBulkSelection } from '@adult-v/shared/hooks/useBulkSelection';

describe('useBulkSelection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('初期化', () => {
    it('空の選択状態から開始', () => {
      const { result } = renderHook(() => useBulkSelection());

      expect(result.current.selectedItems).toEqual([]);
      expect(result.current.selectedCount).toBe(0);
      expect(result.current.isSelectionMode).toBe(false);
    });
  });

  describe('toggleItem', () => {
    it('アイテムを選択に追加', () => {
      const { result } = renderHook(() => useBulkSelection());

      act(() => {
        result.current.toggleItem('item-1');
      });

      expect(result.current.selectedItems).toContain('item-1');
      expect(result.current.selectedCount).toBe(1);
    });

    it('選択済みアイテムを解除', () => {
      const { result } = renderHook(() => useBulkSelection());

      act(() => {
        result.current.toggleItem('item-1');
      });

      act(() => {
        result.current.toggleItem('item-1');
      });

      expect(result.current.selectedItems).not.toContain('item-1');
      expect(result.current.selectedCount).toBe(0);
    });

    it('複数アイテムを選択', () => {
      const { result } = renderHook(() => useBulkSelection());

      act(() => {
        result.current.toggleItem('item-1');
        result.current.toggleItem('item-2');
        result.current.toggleItem('item-3');
      });

      expect(result.current.selectedCount).toBe(3);
    });
  });

  describe('selectItem / deselectItem', () => {
    it('selectItemでアイテムを追加', () => {
      const { result } = renderHook(() => useBulkSelection());

      act(() => {
        result.current.selectItem('item-1');
      });

      expect(result.current.isSelected('item-1')).toBe(true);
    });

    it('deselectItemでアイテムを解除', () => {
      const { result } = renderHook(() => useBulkSelection());

      act(() => {
        result.current.selectItem('item-1');
      });

      act(() => {
        result.current.deselectItem('item-1');
      });

      expect(result.current.isSelected('item-1')).toBe(false);
    });
  });

  describe('selectAll / deselectAll', () => {
    it('selectAllで複数アイテムを一括選択', () => {
      const { result } = renderHook(() => useBulkSelection());

      act(() => {
        result.current.selectAll(['item-1', 'item-2', 'item-3']);
      });

      expect(result.current.selectedCount).toBe(3);
    });

    it('deselectAllで全選択を解除', () => {
      const { result } = renderHook(() => useBulkSelection());

      act(() => {
        result.current.selectAll(['item-1', 'item-2', 'item-3']);
      });

      act(() => {
        result.current.deselectAll();
      });

      expect(result.current.selectedCount).toBe(0);
    });
  });

  describe('maxItems制限', () => {
    it('デフォルトで最大50件まで', () => {
      const { result } = renderHook(() => useBulkSelection());

      act(() => {
        const items = Array.from({ length: 60 }, (_, i) => `item-${i}`);
        result.current.selectAll(items);
      });

      expect(result.current.selectedCount).toBe(50);
    });

    it('maxItemsオプションで上限を変更', () => {
      const { result } = renderHook(() => useBulkSelection({ maxItems: 5 }));

      act(() => {
        const items = Array.from({ length: 10 }, (_, i) => `item-${i}`);
        result.current.selectAll(items);
      });

      expect(result.current.selectedCount).toBe(5);
    });

    it('上限到達後は新規追加できない', () => {
      const { result } = renderHook(() => useBulkSelection({ maxItems: 3 }));

      act(() => {
        result.current.selectAll(['item-1', 'item-2', 'item-3']);
      });

      act(() => {
        result.current.selectItem('item-4');
      });

      expect(result.current.selectedCount).toBe(3);
      expect(result.current.isSelected('item-4')).toBe(false);
    });
  });

  describe('isSelected', () => {
    it('選択済みアイテムでtrue', () => {
      const { result } = renderHook(() => useBulkSelection());

      act(() => {
        result.current.selectItem('item-1');
      });

      expect(result.current.isSelected('item-1')).toBe(true);
    });

    it('未選択アイテムでfalse', () => {
      const { result } = renderHook(() => useBulkSelection());

      expect(result.current.isSelected('item-1')).toBe(false);
    });
  });

  describe('selectionMode', () => {
    it('toggleSelectionModeで切り替え', () => {
      const { result } = renderHook(() => useBulkSelection());

      act(() => {
        result.current.toggleSelectionMode();
      });

      expect(result.current.isSelectionMode).toBe(true);

      act(() => {
        result.current.toggleSelectionMode();
      });

      expect(result.current.isSelectionMode).toBe(false);
    });

    it('enableSelectionModeで有効化', () => {
      const { result } = renderHook(() => useBulkSelection());

      act(() => {
        result.current.enableSelectionMode();
      });

      expect(result.current.isSelectionMode).toBe(true);
    });

    it('disableSelectionModeで無効化し、選択をクリア', () => {
      const { result } = renderHook(() => useBulkSelection());

      act(() => {
        result.current.enableSelectionMode();
        result.current.selectItem('item-1');
      });

      act(() => {
        result.current.disableSelectionMode();
      });

      expect(result.current.isSelectionMode).toBe(false);
      expect(result.current.selectedCount).toBe(0);
    });

    it('toggleSelectionModeで無効化時に選択をクリア', () => {
      const { result } = renderHook(() => useBulkSelection());

      act(() => {
        result.current.enableSelectionMode();
        result.current.selectItem('item-1');
        result.current.selectItem('item-2');
      });

      expect(result.current.selectedCount).toBe(2);

      act(() => {
        result.current.toggleSelectionMode();
      });

      expect(result.current.selectedCount).toBe(0);
    });
  });

  describe('onSelectionChange callback', () => {
    it('選択変更時にコールバックが呼ばれる', () => {
      const onSelectionChange = vi.fn();
      const { result } = renderHook(() => useBulkSelection({ onSelectionChange }));

      act(() => {
        result.current.selectItem('item-1');
      });

      expect(onSelectionChange).toHaveBeenCalledWith(['item-1']);
    });

    it('解除時もコールバックが呼ばれる', () => {
      const onSelectionChange = vi.fn();
      const { result } = renderHook(() => useBulkSelection({ onSelectionChange }));

      act(() => {
        result.current.selectItem('item-1');
      });

      act(() => {
        result.current.deselectItem('item-1');
      });

      expect(onSelectionChange).toHaveBeenLastCalledWith([]);
    });
  });
});
