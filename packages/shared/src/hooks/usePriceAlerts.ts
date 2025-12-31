'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { STORAGE_KEYS } from '../constants/storage';

/**
 * 価格アラートの設定
 */
export interface PriceAlert {
  productId: string;
  normalizedProductId: string;
  title: string;
  thumbnailUrl?: string;
  currentPrice: number;
  targetPrice?: number; // 希望価格（設定されている場合）
  notifyOnAnySale: boolean; // セールになったら通知
  createdAt: number;
}

/**
 * 価格アラート管理フック
 * LocalStorageを使用して価格アラートを永続化
 */
export function usePriceAlerts() {
  // LocalStorageとの同期
  const subscribe = useCallback((callback: () => void) => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.PRICE_ALERTS || e.key === null) {
        callback();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('local-storage-update', callback);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('local-storage-update', callback);
    };
  }, []);

  const getSnapshot = useCallback((): string => {
    if (typeof window === 'undefined') return '[]';
    return localStorage.getItem(STORAGE_KEYS.PRICE_ALERTS) || '[]';
  }, []);

  const getServerSnapshot = useCallback(() => '[]', []);

  const alertsRaw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // パース済みのアラートリスト
  const alerts: PriceAlert[] = useMemo(() => {
    try {
      return JSON.parse(alertsRaw);
    } catch {
      return [];
    }
  }, [alertsRaw]);

  // アラートを保存
  const saveAlerts = useCallback((newAlerts: PriceAlert[]) => {
    localStorage.setItem(STORAGE_KEYS.PRICE_ALERTS, JSON.stringify(newAlerts));
    window.dispatchEvent(new CustomEvent('local-storage-update'));
  }, []);

  // アラートを追加
  const addAlert = useCallback(
    (alert: Omit<PriceAlert, 'createdAt'>) => {
      const newAlerts = [
        ...alerts.filter((a) => a.productId !== alert.productId),
        { ...alert, createdAt: Date.now() },
      ];
      saveAlerts(newAlerts);
    },
    [alerts, saveAlerts],
  );

  // アラートを削除
  const removeAlert = useCallback(
    (productId: string) => {
      const newAlerts = alerts.filter((a) => a.productId !== productId);
      saveAlerts(newAlerts);
    },
    [alerts, saveAlerts],
  );

  // アラートを更新
  const updateAlert = useCallback(
    (productId: string, updates: Partial<Omit<PriceAlert, 'productId' | 'createdAt'>>) => {
      const newAlerts = alerts.map((a) =>
        a.productId === productId ? { ...a, ...updates } : a,
      );
      saveAlerts(newAlerts);
    },
    [alerts, saveAlerts],
  );

  // 商品がアラート登録済みかチェック
  const hasAlert = useCallback(
    (productId: string): boolean => {
      return alerts.some((a) => a.productId === productId);
    },
    [alerts],
  );

  // 商品のアラートを取得
  const getAlert = useCallback(
    (productId: string): PriceAlert | undefined => {
      return alerts.find((a) => a.productId === productId);
    },
    [alerts],
  );

  // アラート登録をトグル
  const toggleAlert = useCallback(
    (alert: Omit<PriceAlert, 'createdAt'>) => {
      if (hasAlert(alert.productId)) {
        removeAlert(alert.productId);
      } else {
        addAlert(alert);
      }
    },
    [hasAlert, addAlert, removeAlert],
  );

  return {
    alerts,
    addAlert,
    removeAlert,
    updateAlert,
    hasAlert,
    getAlert,
    toggleAlert,
    alertCount: alerts.length,
  };
}

/**
 * 通知設定管理フック
 */
export interface NotificationPreferences {
  saleAlerts: boolean;
  priceDrops: boolean;
  newReleases: boolean;
  forYouRecommendations: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  saleAlerts: true,
  priceDrops: true,
  newReleases: false,
  forYouRecommendations: true,
};

export function useNotificationPreferences() {
  const subscribe = useCallback((callback: () => void) => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.NOTIFICATION_PREFERENCES || e.key === null) {
        callback();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('local-storage-update', callback);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('local-storage-update', callback);
    };
  }, []);

  const getSnapshot = useCallback((): string => {
    if (typeof window === 'undefined') return JSON.stringify(DEFAULT_PREFERENCES);
    return localStorage.getItem(STORAGE_KEYS.NOTIFICATION_PREFERENCES) || JSON.stringify(DEFAULT_PREFERENCES);
  }, []);

  const getServerSnapshot = useCallback(() => JSON.stringify(DEFAULT_PREFERENCES), []);

  const prefsRaw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const preferences: NotificationPreferences = useMemo(() => {
    try {
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(prefsRaw) };
    } catch {
      return DEFAULT_PREFERENCES;
    }
  }, [prefsRaw]);

  const updatePreferences = useCallback((updates: Partial<NotificationPreferences>) => {
    const current = JSON.parse(localStorage.getItem(STORAGE_KEYS.NOTIFICATION_PREFERENCES) || JSON.stringify(DEFAULT_PREFERENCES));
    const newPrefs = { ...current, ...updates };
    localStorage.setItem(STORAGE_KEYS.NOTIFICATION_PREFERENCES, JSON.stringify(newPrefs));
    window.dispatchEvent(new CustomEvent('local-storage-update'));
  }, []);

  return {
    preferences,
    updatePreferences,
  };
}
