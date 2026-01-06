'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  isFirebaseConfigured,
  saveFavoriteToFirestore,
  removeFavoriteFromFirestore,
  getFavoritesFromFirestore,
  logEvent,
} from '../lib/firebase';
import { useFirebaseAuth } from '../contexts/FirebaseAuthContext';

export interface FirestoreFavoriteItem {
  type: 'product' | 'actress';
  id: string;
  title?: string;
  name?: string;
  thumbnail?: string;
  addedAt: number;
}

const STORAGE_KEY = 'adult-v-favorites';

/**
 * Firestore連携付きお気に入りフック
 * - Firebaseが未設定の場合はLocalStorageのみ使用
 * - Firebaseが設定されている場合は自動的にFirestoreと同期
 * - オフライン時はLocalStorageを使用し、オンライン復帰時に同期
 */
export function useFirestoreFavorites() {
  const { user, isFirebaseEnabled } = useFirebaseAuth();
  const [favorites, setFavorites] = useState<FirestoreFavoriteItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as FirestoreFavoriteItem[];
        setFavorites(parsed);
      }
    } catch (error) {
      console.error('Failed to load favorites from localStorage:', error);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Sync with Firestore when user is available
  useEffect(() => {
    if (!isFirebaseEnabled || !user || !isLoaded) return;

    const syncWithFirestore = async () => {
      setIsSyncing(true);
      try {
        // Get favorites from Firestore
        const firestoreFavorites = await getFavoritesFromFirestore(user.uid);

        // Merge with local favorites (Firestore takes precedence for conflicts)
        const firestoreMap = new Map(
          firestoreFavorites.map((f) => [`${f.type}_${f.itemId}`, f])
        );

        const localFavorites = [...favorites];
        const mergedFavorites: FirestoreFavoriteItem[] = [];

        // Add all Firestore items
        for (const fsItem of firestoreFavorites) {
          mergedFavorites.push({
            type: fsItem.type,
            id: fsItem.itemId,
            ...(fsItem.title !== undefined && { title: fsItem.title }),
            ...(fsItem.name !== undefined && { name: fsItem.name }),
            ...(fsItem.thumbnail !== undefined && { thumbnail: fsItem.thumbnail }),
            addedAt: Date.now(), // Firestore timestamp is server-side
          });
        }

        // Add local items that don't exist in Firestore (and upload them)
        for (const localItem of localFavorites) {
          const key = `${localItem.type}_${localItem.id}`;
          if (!firestoreMap.has(key)) {
            mergedFavorites.push(localItem);
            // Upload to Firestore
            await saveFavoriteToFirestore(user.uid, {
              type: localItem.type,
              itemId: localItem.id,
              ...(localItem.title !== undefined && { title: localItem.title }),
              ...(localItem.name !== undefined && { name: localItem.name }),
              ...(localItem.thumbnail !== undefined && { thumbnail: localItem.thumbnail }),
            });
          }
        }

        setFavorites(mergedFavorites);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedFavorites));
      } catch (error) {
        console.error('Failed to sync favorites with Firestore:', error);
      } finally {
        setIsSyncing(false);
      }
    };

    syncWithFirestore();
  }, [isFirebaseEnabled, user, isLoaded]); // Note: favorites removed from deps to avoid loop

  // Save to localStorage whenever favorites change
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
      } catch (error) {
        console.error('Failed to save favorites to localStorage:', error);
      }
    }
  }, [favorites, isLoaded]);

  const addFavorite = useCallback(
    async (item: Omit<FirestoreFavoriteItem, 'addedAt'>) => {
      const newItem: FirestoreFavoriteItem = {
        ...item,
        addedAt: Date.now(),
      };

      setFavorites((prev) => {
        // Check if already exists
        const exists = prev.some((f) => f.type === item.type && f.id === item['id']);
        if (exists) return prev;
        return [newItem, ...prev];
      });

      // Log analytics event
      logEvent('add_favorite', { item_type: item.type, item_id: item['id'] });

      // Save to Firestore if available
      if (isFirebaseEnabled && user) {
        await saveFavoriteToFirestore(user.uid, {
          type: item.type,
          itemId: item['id'],
          ...(item['title'] !== undefined && { title: item['title'] }),
          ...(item['name'] !== undefined && { name: item['name'] }),
          ...(item['thumbnail'] !== undefined && { thumbnail: item['thumbnail'] }),
        });
      }
    },
    [isFirebaseEnabled, user]
  );

  const removeFavorite = useCallback(
    async (type: 'product' | 'actress', id: string) => {
      setFavorites((prev) => prev.filter((f) => !(f.type === type && f.id === id)));

      // Log analytics event
      logEvent('remove_favorite', { item_type: type, item_id: id });

      // Remove from Firestore if available
      if (isFirebaseEnabled && user) {
        await removeFavoriteFromFirestore(user.uid, type, id);
      }
    },
    [isFirebaseEnabled, user]
  );

  const isFavorite = useCallback(
    (type: 'product' | 'actress', id: string) => {
      return favorites.some((f) => f.type === type && f.id === id);
    },
    [favorites]
  );

  const toggleFavorite = useCallback(
    async (item: Omit<FirestoreFavoriteItem, 'addedAt'>) => {
      if (isFavorite(item.type, item['id'])) {
        await removeFavorite(item.type, item['id']);
      } else {
        await addFavorite(item);
      }
    },
    [isFavorite, removeFavorite, addFavorite]
  );

  const getFavoritesByType = useCallback(
    (type: 'product' | 'actress') => {
      return favorites.filter((f) => f.type === type);
    },
    [favorites]
  );

  const clearFavorites = useCallback(async () => {
    setFavorites([]);

    // Clear from Firestore if available
    if (isFirebaseEnabled && user) {
      const all = await getFavoritesFromFirestore(user.uid);
      for (const item of all) {
        await removeFavoriteFromFirestore(user.uid, item.type, item.itemId);
      }
    }
  }, [isFirebaseEnabled, user]);

  return useMemo(
    () => ({
      favorites,
      isLoaded,
      isSyncing,
      addFavorite,
      removeFavorite,
      isFavorite,
      toggleFavorite,
      getFavoritesByType,
      clearFavorites,
      totalCount: favorites.length,
    }),
    [
      favorites,
      isLoaded,
      isSyncing,
      addFavorite,
      removeFavorite,
      isFavorite,
      toggleFavorite,
      getFavoritesByType,
      clearFavorites,
    ]
  );
}
