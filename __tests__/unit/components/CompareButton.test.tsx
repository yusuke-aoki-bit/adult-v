/**
 * CompareButtonコンポーネントのテスト
 * 比較ボタンのテスト
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CompareButton from '@adult-v/shared/components/CompareButton';

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

describe('CompareButton', () => {
  // productプロップとして渡す
  const defaultProduct = {
    id: 'test-123',
    title: 'Test Product',
    imageUrl: 'https://example.com/thumb.jpg',
  };

  beforeEach(() => {
    vi.stubGlobal('localStorage', localStorageMock);
    localStorageMock.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('表示', () => {
    it('デフォルトでボタンを表示', () => {
      render(<CompareButton product={defaultProduct} />);

      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('showLabelがtrueの場合にラベルを表示', () => {
      render(<CompareButton product={defaultProduct} showLabel locale="ja" />);

      expect(screen.getByText('比較に追加')).toBeInTheDocument();
    });

    it('英語ラベルを表示', () => {
      render(<CompareButton product={defaultProduct} showLabel locale="en" />);

      expect(screen.getByText('Add to compare')).toBeInTheDocument();
    });
  });

  describe('サイズ', () => {
    it('smサイズ', () => {
      render(<CompareButton product={defaultProduct} size="sm" />);

      const button = screen.getByRole('button');
      expect(button.className).toContain('p-1.5');
    });

    it('mdサイズ（デフォルト）', () => {
      render(<CompareButton product={defaultProduct} size="md" />);

      const button = screen.getByRole('button');
      expect(button.className).toContain('p-2');
    });

    it('lgサイズ', () => {
      render(<CompareButton product={defaultProduct} size="lg" />);

      const button = screen.getByRole('button');
      expect(button.className).toContain('p-2.5');
    });
  });

  describe('テーマ', () => {
    it('ダークテーマ（デフォルト）', () => {
      render(<CompareButton product={defaultProduct} theme="dark" />);

      const button = screen.getByRole('button');
      // 非選択時のダークテーマスタイル
      expect(button.className).toContain('bg-gray-700');
    });

    it('ライトテーマ', () => {
      render(<CompareButton product={defaultProduct} theme="light" />);

      const button = screen.getByRole('button');
      // 非選択時のライトテーマスタイル
      expect(button.className).toContain('bg-gray-100');
    });
  });

  describe('インタラクション', () => {
    it('クリックで比較リストに追加', () => {
      render(<CompareButton product={defaultProduct} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'product_compare_list',
        expect.stringContaining('test-123'),
      );
    });

    it('追加済みの場合、クリックで削除', () => {
      // 事前にリストに追加
      const existingItems = [{ id: 'test-123', title: 'Test', addedAt: Date.now() }];
      localStorageMock.setItem('product_compare_list', JSON.stringify(existingItems));

      render(<CompareButton product={defaultProduct} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      // 削除されたことを確認
      const calls = localStorageMock.setItem.mock.calls;
      const lastCall = calls[calls.length - 1]!;
      expect(lastCall[1]).not.toContain('test-123');
    });
  });

  describe('選択状態', () => {
    it('リストにない場合は非選択状態', () => {
      render(<CompareButton product={defaultProduct} theme="dark" />);

      const button = screen.getByRole('button');
      // 非選択時のダークスタイル
      expect(button.className).toContain('bg-gray-700');
    });

    it('リストにある場合は選択状態', () => {
      const existingItems = [{ id: 'test-123', title: 'Test', addedAt: Date.now() }];
      localStorageMock.setItem('product_compare_list', JSON.stringify(existingItems));

      render(<CompareButton product={defaultProduct} theme="dark" />);

      const button = screen.getByRole('button');
      // 選択時のダークスタイル
      expect(button.className).toContain('bg-blue-600');
    });
  });

  describe('aria-label', () => {
    it('非選択時に適切なaria-label', () => {
      render(<CompareButton product={defaultProduct} locale="ja" />);

      const button = screen.getByRole('button');
      expect(button.getAttribute('aria-label')).toBe('比較に追加');
    });

    it('選択時に適切なaria-label', () => {
      const existingItems = [{ id: 'test-123', title: 'Test', addedAt: Date.now() }];
      localStorageMock.setItem('product_compare_list', JSON.stringify(existingItems));

      render(<CompareButton product={defaultProduct} locale="ja" />);

      const button = screen.getByRole('button');
      expect(button.getAttribute('aria-label')).toBe('比較から削除');
    });
  });

  describe('title属性', () => {
    it('非選択時に適切なtitle', () => {
      render(<CompareButton product={defaultProduct} locale="ja" />);

      const button = screen.getByRole('button');
      expect(button.getAttribute('title')).toBe('比較に追加');
    });

    it('リスト満杯時に適切なtitle', () => {
      const fullList = Array.from({ length: 4 }, (_, i) => ({
        id: `existing-${i}`,
        title: `Product ${i}`,
        addedAt: Date.now(),
      }));
      localStorageMock.setItem('product_compare_list', JSON.stringify(fullList));

      render(<CompareButton product={defaultProduct} locale="ja" />);

      const button = screen.getByRole('button');
      expect(button.getAttribute('title')).toContain('満杯');
    });
  });
});
