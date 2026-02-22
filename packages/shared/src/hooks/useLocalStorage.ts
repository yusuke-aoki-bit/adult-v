'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';

const LOCAL_STORAGE_UPDATE_EVENT = 'local-storage-update';

/**
 * useSyncExternalStore ベースの汎用 localStorage hook
 *
 * - クロスタブ同期（storage event）
 * - 同一タブ同期（local-storage-update custom event）
 * - SSR安全（getServerSnapshot で defaultValue）
 * - useState互換 [value, setValue] API
 */
export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const serializedDefault = useMemo(
    () => JSON.stringify(defaultValue),
    // defaultValue は呼び出し元で安定させる前提（既存hookの慣例と同じ）
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const subscribe = useCallback(
    (callback: () => void) => {
      const handleStorageChange = (e: StorageEvent) => {
        if (e.key === key || e.key === null) {
          callback();
        }
      };
      window.addEventListener('storage', handleStorageChange);
      window.addEventListener(LOCAL_STORAGE_UPDATE_EVENT, callback);
      return () => {
        window.removeEventListener('storage', handleStorageChange);
        window.removeEventListener(LOCAL_STORAGE_UPDATE_EVENT, callback);
      };
    },
    [key],
  );

  const getSnapshot = useCallback((): string => {
    return localStorage.getItem(key) ?? serializedDefault;
  }, [key, serializedDefault]);

  const getServerSnapshot = useCallback(
    () => serializedDefault,
    [serializedDefault],
  );

  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const value: T = useMemo(() => {
    try {
      return JSON.parse(raw);
    } catch {
      return defaultValue;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw]);

  const setValue = useCallback(
    (newValue: T | ((prev: T) => T)) => {
      const resolved =
        typeof newValue === 'function'
          ? (newValue as (prev: T) => T)(
              (() => {
                try {
                  return JSON.parse(localStorage.getItem(key) ?? serializedDefault);
                } catch {
                  return defaultValue;
                }
              })(),
            )
          : newValue;
      localStorage.setItem(key, JSON.stringify(resolved));
      window.dispatchEvent(new Event(LOCAL_STORAGE_UPDATE_EVENT));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, serializedDefault],
  );

  return [value, setValue];
}
