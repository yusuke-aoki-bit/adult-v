/**
 * useDebounceフックのテスト
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce } from '@adult-v/shared/hooks/useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('初期値を即座に返す', () => {
    const { result } = renderHook(() => useDebounce('initial', 500));

    expect(result.current).toBe('initial');
  });

  it('delay後に新しい値を返す', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    );

    expect(result.current).toBe('initial');

    // 値を変更
    rerender({ value: 'updated', delay: 500 });

    // まだ古い値
    expect(result.current).toBe('initial');

    // 500ms経過
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // 新しい値
    expect(result.current).toBe('updated');
  });

  it('delay内の連続した変更は最後の値のみ反映', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'v1', delay: 500 } }
    );

    // 連続して値を変更
    rerender({ value: 'v2', delay: 500 });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    rerender({ value: 'v3', delay: 500 });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    rerender({ value: 'v4', delay: 500 });

    // まだ初期値
    expect(result.current).toBe('v1');

    // 500ms経過（最後の変更から）
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // 最後の値のみ反映
    expect(result.current).toBe('v4');
  });

  it('異なるdelay値でも動作する', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 1000 } }
    );

    rerender({ value: 'updated', delay: 1000 });

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe('initial');

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe('updated');
  });

  it('delay=0でも正常に動作', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 0 } }
    );

    rerender({ value: 'updated', delay: 0 });

    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(result.current).toBe('updated');
  });

  it('数値型でも動作', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 100, delay: 300 } }
    );

    rerender({ value: 200, delay: 300 });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toBe(200);
  });

  it('オブジェクト型でも動作', () => {
    const initialObj = { name: 'initial' };
    const updatedObj = { name: 'updated' };

    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: initialObj, delay: 300 } }
    );

    rerender({ value: updatedObj, delay: 300 });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toEqual({ name: 'updated' });
  });

  it('アンマウント時にタイマーをクリア', () => {
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

    const { unmount, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    );

    rerender({ value: 'updated', delay: 500 });

    // タイマーが設定されている状態でアンマウント
    unmount();

    // clearTimeoutが呼ばれたことを確認
    expect(clearTimeoutSpy).toHaveBeenCalled();

    clearTimeoutSpy.mockRestore();
  });

  it('null値も扱える', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: null as string | null, delay: 300 } }
    );

    expect(result.current).toBe(null);

    rerender({ value: 'not null', delay: 300 });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toBe('not null');
  });

  it('undefined値も扱える', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: undefined as string | undefined, delay: 300 } }
    );

    expect(result.current).toBe(undefined);

    rerender({ value: 'defined', delay: 300 });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toBe('defined');
  });

  it('delay変更時にタイマーをリセット', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    );

    rerender({ value: 'updated', delay: 500 });

    // 300ms経過
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // delayを変更
    rerender({ value: 'updated', delay: 1000 });

    // さらに200ms経過（合計500ms）
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // まだ古い値（delayが変更されたのでタイマーリセット）
    expect(result.current).toBe('initial');

    // 残り800ms経過（新しいdelayの1000ms）
    act(() => {
      vi.advanceTimersByTime(800);
    });

    expect(result.current).toBe('updated');
  });
});
