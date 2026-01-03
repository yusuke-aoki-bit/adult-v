'use client';

import { useState, useEffect, useCallback } from 'react';

export interface OnlineStatusOptions {
  /** オフラインになった時のコールバック */
  onOffline?: () => void;
  /** オンラインに復帰した時のコールバック */
  onOnline?: () => void;
  /** ポーリング間隔（ms）- 0で無効化 */
  pollingInterval?: number;
  /** ポーリングで確認するURL */
  pingUrl?: string;
}

export interface OnlineStatus {
  /** 現在オンラインかどうか */
  isOnline: boolean;
  /** 最後にオフラインになった時刻 */
  lastOfflineAt: Date | null;
  /** オフラインになってからの経過時間（秒） */
  offlineDuration: number | null;
  /** 手動で接続状態を確認 */
  checkConnection: () => Promise<boolean>;
}

/**
 * オンライン/オフライン状態を監視するhook
 *
 * @example
 * const { isOnline, offlineDuration } = useOnlineStatus({
 *   onOffline: () => toast.warning('オフラインです'),
 *   onOnline: () => toast.success('オンラインに復帰しました'),
 * });
 */
export function useOnlineStatus(options: OnlineStatusOptions = {}): OnlineStatus {
  const { onOffline, onOnline, pollingInterval = 0, pingUrl } = options;

  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [lastOfflineAt, setLastOfflineAt] = useState<Date | null>(null);
  const [offlineDuration, setOfflineDuration] = useState<number | null>(null);

  // 接続状態を確認
  const checkConnection = useCallback(async (): Promise<boolean> => {
    if (typeof navigator === 'undefined') return true;

    // navigator.onLineがfalseなら確実にオフライン
    if (!navigator.onLine) {
      return false;
    }

    // pingUrlが指定されていれば実際にリクエストを送信
    if (pingUrl) {
      try {
        const response = await fetch(pingUrl, {
          method: 'HEAD',
          cache: 'no-store',
          mode: 'no-cors',
        });
        return response.ok || response.type === 'opaque';
      } catch {
        return false;
      }
    }

    return navigator.onLine;
  }, [pingUrl]);

  // オンライン/オフライン切り替え処理
  const handleOnline = useCallback(() => {
    setIsOnline(true);
    setOfflineDuration(null);
    onOnline?.();
  }, [onOnline]);

  const handleOffline = useCallback(() => {
    setIsOnline(false);
    setLastOfflineAt(new Date());
    onOffline?.();
  }, [onOffline]);

  // イベントリスナーの設定
  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 初期状態を確認
    if (!navigator.onLine) {
      handleOffline();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleOnline, handleOffline]);

  // オフライン経過時間の更新
  useEffect(() => {
    if (isOnline || !lastOfflineAt) return;

    const interval = setInterval(() => {
      const duration = Math.floor((Date.now() - lastOfflineAt.getTime()) / 1000);
      setOfflineDuration(duration);
    }, 1000);

    return () => clearInterval(interval);
  }, [isOnline, lastOfflineAt]);

  // ポーリングによる接続確認
  useEffect(() => {
    if (pollingInterval <= 0) return;

    const interval = setInterval(async () => {
      const online = await checkConnection();
      if (online !== isOnline) {
        if (online) {
          handleOnline();
        } else {
          handleOffline();
        }
      }
    }, pollingInterval);

    return () => clearInterval(interval);
  }, [pollingInterval, isOnline, checkConnection, handleOnline, handleOffline]);

  return {
    isOnline,
    lastOfflineAt,
    offlineDuration,
    checkConnection,
  };
}
