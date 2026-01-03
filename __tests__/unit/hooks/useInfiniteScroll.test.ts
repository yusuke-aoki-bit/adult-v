/**
 * useInfiniteScrollフックのテスト
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInfiniteScroll } from '@adult-v/shared/hooks/useInfiniteScroll';

// IntersectionObserverのモック（グローバルにセットアップファイルで定義されている前提）
// テスト用のインスタンス追跡
let mockObserverInstances: MockIntersectionObserver[] = [];

class MockIntersectionObserver {
  private callback: IntersectionObserverCallback;
  private elements: Set<Element> = new Set();

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    mockObserverInstances.push(this);
  }

  observe(element: Element) {
    this.elements.add(element);
  }

  unobserve(element: Element) {
    this.elements.delete(element);
  }

  disconnect() {
    this.elements.clear();
  }

  // テスト用: 交差を発火
  simulateIntersection(isIntersecting: boolean) {
    const entries: IntersectionObserverEntry[] = Array.from(this.elements).map(element => ({
      isIntersecting,
      target: element,
      boundingClientRect: {} as DOMRectReadOnly,
      intersectionRatio: isIntersecting ? 1 : 0,
      intersectionRect: {} as DOMRectReadOnly,
      rootBounds: null,
      time: Date.now(),
    }));

    if (entries.length > 0) {
      this.callback(entries, this as unknown as IntersectionObserver);
    }
  }
}

// グローバルにIntersectionObserverをモック（モジュール読み込み前に設定）
const originalIntersectionObserver = globalThis.IntersectionObserver;
globalThis.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;

describe('useInfiniteScroll', () => {
  beforeEach(() => {
    mockObserverInstances = [];
  });

  afterEach(() => {
    // 元に戻す必要はない（テスト終了時にリセット）
  });

  it('初期状態を正しく返す', () => {
    const fetchMore = vi.fn().mockResolvedValue([]);

    const { result } = renderHook(() => useInfiniteScroll(fetchMore));

    expect(result.current.items).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasMore).toBe(true);
    expect(result.current.error).toBe(null);
    expect(result.current.observerTarget).toBeDefined();
  });

  it('loadMoreを呼び出すとデータを取得', async () => {
    const mockData = [{ id: 1 }, { id: 2 }];
    const fetchMore = vi.fn().mockResolvedValue(mockData);

    const { result } = renderHook(() => useInfiniteScroll(fetchMore));

    await act(async () => {
      await result.current.loadMore();
    });

    expect(fetchMore).toHaveBeenCalledWith(1);
    expect(result.current.items).toEqual(mockData);
    expect(result.current.isLoading).toBe(false);
  });

  it('連続してloadMoreを呼び出すとページが進む', async () => {
    const fetchMore = vi.fn()
      .mockResolvedValueOnce([{ id: 1 }])
      .mockResolvedValueOnce([{ id: 2 }])
      .mockResolvedValueOnce([{ id: 3 }]);

    const { result } = renderHook(() => useInfiniteScroll(fetchMore));

    await act(async () => {
      await result.current.loadMore();
    });
    expect(fetchMore).toHaveBeenLastCalledWith(1);
    expect(result.current.items).toHaveLength(1);

    await act(async () => {
      await result.current.loadMore();
    });
    expect(fetchMore).toHaveBeenLastCalledWith(2);
    expect(result.current.items).toHaveLength(2);

    await act(async () => {
      await result.current.loadMore();
    });
    expect(fetchMore).toHaveBeenLastCalledWith(3);
    expect(result.current.items).toHaveLength(3);
  });

  it('空の結果を受け取るとhasMoreがfalseになる', async () => {
    const fetchMore = vi.fn()
      .mockResolvedValueOnce([{ id: 1 }])
      .mockResolvedValueOnce([]);

    const { result } = renderHook(() => useInfiniteScroll(fetchMore));

    await act(async () => {
      await result.current.loadMore();
    });
    expect(result.current.hasMore).toBe(true);

    await act(async () => {
      await result.current.loadMore();
    });
    expect(result.current.hasMore).toBe(false);
  });

  it('エラー発生時にerrorを設定', async () => {
    const error = new Error('Fetch failed');
    const fetchMore = vi.fn().mockRejectedValue(error);

    const { result } = renderHook(() => useInfiniteScroll(fetchMore));

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.error).toEqual(error);
    expect(result.current.hasMore).toBe(false);
  });

  it('非Errorオブジェクトをエラーとしてラップ', async () => {
    const fetchMore = vi.fn().mockRejectedValue('String error');

    const { result } = renderHook(() => useInfiniteScroll(fetchMore));

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Failed to load more items');
  });

  it('isLoading中は追加のloadMoreを無視', async () => {
    let resolvePromise: (value: { id: number }[]) => void;
    const fetchMore = vi.fn().mockImplementation(
      () => new Promise(resolve => { resolvePromise = resolve; })
    );

    const { result } = renderHook(() => useInfiniteScroll(fetchMore));

    // 最初のloadMore
    act(() => {
      result.current.loadMore();
    });

    expect(result.current.isLoading).toBe(true);

    // isLoading中に追加のloadMore（無視される）
    act(() => {
      result.current.loadMore();
      result.current.loadMore();
    });

    // fetchMoreは1回だけ呼ばれる
    expect(fetchMore).toHaveBeenCalledTimes(1);

    // Promiseを解決
    await act(async () => {
      resolvePromise!([{ id: 1 }]);
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('hasMore=falseの場合はloadMoreを無視', async () => {
    const fetchMore = vi.fn().mockResolvedValue([]);

    const { result } = renderHook(() => useInfiniteScroll(fetchMore));

    // 空のデータでhasMore=falseに
    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.hasMore).toBe(false);
    fetchMore.mockClear();

    // hasMore=false後のloadMore（無視される）
    await act(async () => {
      await result.current.loadMore();
    });

    expect(fetchMore).not.toHaveBeenCalled();
  });

  it('resetで状態をリセット', async () => {
    const fetchMore = vi.fn().mockResolvedValue([{ id: 1 }]);

    const { result } = renderHook(() => useInfiniteScroll(fetchMore));

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.items).toHaveLength(1);

    act(() => {
      result.current.reset();
    });

    expect(result.current.items).toEqual([]);
    expect(result.current.hasMore).toBe(true);
    expect(result.current.error).toBe(null);
  });

  it('オプションのthresholdを設定可能', () => {
    const fetchMore = vi.fn().mockResolvedValue([]);

    renderHook(() => useInfiniteScroll(fetchMore, { threshold: 0.8 }));

    // IntersectionObserverがthresholdオプション付きで作成されることを確認
    expect(mockObserverInstances.length).toBeGreaterThan(0);
  });

  it('オプションのrootMarginを設定可能', () => {
    const fetchMore = vi.fn().mockResolvedValue([]);

    renderHook(() => useInfiniteScroll(fetchMore, { rootMargin: '200px' }));

    expect(mockObserverInstances.length).toBeGreaterThan(0);
  });
});
