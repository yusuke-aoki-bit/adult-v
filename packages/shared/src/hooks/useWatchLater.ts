'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useFirebaseAuth } from '../contexts/FirebaseAuthContext';
import {
  saveWatchlistItemToFirestore,
  removeWatchlistItemFromFirestore,
  getWatchlistFromFirestore,
} from '../lib/firebase';

export interface WatchLaterItem {
  productId: string;
  title: string;
  thumbnail?: string;
  provider?: string;
  addedAt: number;
}

const STORAGE_KEY = 'watch-later-list';
const MAX_ITEMS = 100;

/**
 * 後で見るリストを管理するフック
 * Firestoreとの同期機能付き
 */
export function useWatchLater() {
  const [items, setItems] = useState<WatchLaterItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const initialSyncDone = useRef(false);

  const { user, isAuthenticated } = useFirebaseAuth();
  const userId = user?.uid;

  // localStorageから読み込み
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as WatchLaterItem[];
        setItems(parsed);
      }
    } catch (error) {
      console.error('[useWatchLater] Failed to load:', error);
    }
    setIsLoaded(true);
  }, []);

  // Firestoreとの同期（ソーシャルログイン時のみ）
  useEffect(() => {
    if (!isAuthenticated || !userId || initialSyncDone.current) {
      return;
    }

    const syncWithFirestore = async () => {
      setIsSyncing(true);
      try {
        // Firestoreからデータ取得
        const firestoreItems = await getWatchlistFromFirestore(userId);

        // 現在のlocalStorageデータ取得
        let localItems: WatchLaterItem[] = [];
        try {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            localItems = JSON.parse(stored);
          }
        } catch {
          /* ignore */
        }

        // マージ: Firestoreにあるものをローカルに追加
        const localProductIds = new Set(localItems.map(i => i.productId));
        const firestoreProductIds = new Set(firestoreItems.map(i => i.productId));

        // Firestoreにしかないアイテムをローカルに追加
        const mergedItems = [...localItems];
        for (const firestoreItem of firestoreItems) {
          if (!localProductIds.has(firestoreItem.productId)) {
            mergedItems.push({
              productId: firestoreItem.productId,
              title: firestoreItem.title,
              thumbnail: firestoreItem.thumbnail,
              provider: firestoreItem.provider,
              addedAt: Date.now(), // Firestore timestampは変換が必要なのでDate.nowを使用
            });
          }
        }

        // ローカルにしかないアイテムをFirestoreにアップロード
        for (const localItem of localItems) {
          if (!firestoreProductIds.has(localItem.productId)) {
            await saveWatchlistItemToFirestore(userId, {
              productId: localItem.productId,
              title: localItem.title,
              thumbnail: localItem.thumbnail,
              provider: localItem.provider,
            });
          }
        }

        // 最大件数を超える場合は古いものを削除
        const sortedItems = mergedItems
          .sort((a, b) => b.addedAt - a.addedAt)
          .slice(0, MAX_ITEMS);

        // localStorageを更新
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sortedItems));
        setItems(sortedItems);

        initialSyncDone.current = true;
      } catch (error) {
        console.error('[useWatchLater] Failed to sync with Firestore:', error);
      } finally {
        setIsSyncing(false);
      }
    };

    syncWithFirestore();
  }, [isAuthenticated, userId]);

  // localStorageに保存
  const saveItems = useCallback((newItems: WatchLaterItem[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newItems));
    } catch (error) {
      console.error('[useWatchLater] Failed to save:', error);
    }
  }, []);

  // アイテムを追加
  const addItem = useCallback(
    (item: Omit<WatchLaterItem, 'addedAt'>) => {
      setItems(prev => {
        // 既に存在する場合は追加しない
        if (prev.some(i => i.productId === item.productId)) {
          return prev;
        }

        const newItem: WatchLaterItem = {
          ...item,
          addedAt: Date.now(),
        };

        // 最大件数を超える場合は古いものを削除
        const newItems = [newItem, ...prev].slice(0, MAX_ITEMS);
        saveItems(newItems);

        // Firestoreにも保存（ログイン済みの場合）
        if (isAuthenticated && userId) {
          saveWatchlistItemToFirestore(userId, {
            productId: item.productId,
            title: item.title,
            thumbnail: item.thumbnail,
            provider: item.provider,
          }).catch(console.error);
        }

        return newItems;
      });
    },
    [saveItems, isAuthenticated, userId]
  );

  // アイテムを削除
  const removeItem = useCallback(
    (productId: string) => {
      setItems(prev => {
        const newItems = prev.filter(i => i.productId !== productId);
        saveItems(newItems);

        // Firestoreからも削除（ログイン済みの場合）
        if (isAuthenticated && userId) {
          removeWatchlistItemFromFirestore(userId, productId).catch(console.error);
        }

        return newItems;
      });
    },
    [saveItems, isAuthenticated, userId]
  );

  // アイテムが存在するかチェック
  const hasItem = useCallback(
    (productId: string) => {
      return items.some(i => i.productId === productId);
    },
    [items]
  );

  // トグル（追加/削除）
  const toggleItem = useCallback(
    (item: Omit<WatchLaterItem, 'addedAt'>) => {
      if (hasItem(item.productId)) {
        removeItem(item.productId);
      } else {
        addItem(item);
      }
    },
    [hasItem, addItem, removeItem]
  );

  // すべてクリア
  const clearAll = useCallback(() => {
    setItems([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('[useWatchLater] Failed to clear:', error);
    }
    // Firestoreからの一括削除はコスト高いため実装しない（ローカルのみクリア）
  }, []);

  return {
    items,
    isLoaded,
    isSyncing,
    addItem,
    removeItem,
    hasItem,
    toggleItem,
    clearAll,
    count: items.length,
  };
}

/**
 * 単一作品用のシンプルなフック
 */
export function useWatchLaterItem(productId: string) {
  const { hasItem, toggleItem, isLoaded, isSyncing } = useWatchLater();

  const isInList = hasItem(productId);

  const toggle = useCallback(
    (item: Omit<WatchLaterItem, 'addedAt' | 'productId'>) => {
      toggleItem({ ...item, productId });
    },
    [toggleItem, productId]
  );

  return {
    isInList,
    isLoaded,
    isSyncing,
    toggle,
  };
}
