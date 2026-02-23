'use client';

import React, {
  createContext,
  useContext,
  useSyncExternalStore,
  ReactNode,
  useCallback,
  useMemo,
  useEffect,
  useState,
  useRef,
} from 'react';
import { STORAGE_KEYS } from '../constants/storage';

interface FavoritesContextType {
  favoriteActresses: Set<number>;
  favoriteProducts: Set<string>;
  toggleActressFavorite: (actressId: number) => void;
  toggleProductFavorite: (productId: string) => void;
  isActressFavorite: (actressId: number) => boolean;
  isProductFavorite: (productId: string) => boolean;
  isCloudSyncEnabled: boolean;
  isSyncing: boolean;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

// Custom hook to sync with localStorage using useSyncExternalStore
function useLocalStorageValue(key: string): string {
  const subscribe = useCallback(
    (callback: () => void) => {
      const handleStorageChange = (e: StorageEvent) => {
        if (e.key === key || e.key === null) {
          callback();
        }
      };
      window.addEventListener('storage', handleStorageChange);
      window.addEventListener('local-storage-update', callback);
      return () => {
        window.removeEventListener('storage', handleStorageChange);
        window.removeEventListener('local-storage-update', callback);
      };
    },
    [key],
  );

  const getSnapshot = useCallback(() => {
    return localStorage.getItem(key) || '[]';
  }, [key]);

  const getServerSnapshot = useCallback(() => '[]', []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// Hook to check cloud sync setting
function useCloudSyncSetting(): boolean {
  const subscribe = useCallback((callback: () => void) => {
    window.addEventListener('storage', callback);
    window.addEventListener('local-storage-update', callback);
    return () => {
      window.removeEventListener('storage', callback);
      window.removeEventListener('local-storage-update', callback);
    };
  }, []);

  const getSnapshot = useCallback(() => {
    return localStorage.getItem(STORAGE_KEYS.CLOUD_SYNC_ENABLED) === 'true';
  }, []);

  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// Dynamic import helper for Firebase (lazy loading)
async function getFirebaseModule() {
  const firebase = await import('../lib/firebase');
  return firebase;
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const actressesRaw = useLocalStorageValue(STORAGE_KEYS.FAVORITE_ACTRESSES);
  const productsRaw = useLocalStorageValue(STORAGE_KEYS.FAVORITE_PRODUCTS);
  const isCloudSyncEnabled = useCloudSyncSetting();

  const [firebaseUserId, setFirebaseUserId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const initialSyncDone = useRef(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Initialize Firebase auth when cloud sync is enabled (lazy load)
  useEffect(() => {
    if (!isCloudSyncEnabled) {
      setFirebaseUserId(null);
      initialSyncDone.current = false;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      return;
    }

    let mounted = true;

    const initFirebase = async () => {
      try {
        const firebase = await getFirebaseModule();
        if (!mounted || !firebase.isFirebaseConfigured()) {
          return;
        }

        // Sign in anonymously
        await firebase.signInAnonymouslyIfNeeded();

        // Listen to auth state
        unsubscribeRef.current = firebase.onAuthStateChange((user) => {
          if (mounted) {
            setFirebaseUserId(user?.uid || null);
          }
        });
      } catch (error) {
        console.error('Failed to initialize Firebase:', error);
      }
    };

    initFirebase();

    return () => {
      mounted = false;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [isCloudSyncEnabled]);

  const favoriteActresses = useMemo(() => {
    try {
      return new Set<number>(JSON.parse(actressesRaw));
    } catch {
      return new Set<number>();
    }
  }, [actressesRaw]);

  const favoriteProducts = useMemo(() => {
    try {
      return new Set<string>(JSON.parse(productsRaw));
    } catch {
      return new Set<string>();
    }
  }, [productsRaw]);

  // Sync with Firestore when user becomes available (only once)
  useEffect(() => {
    if (!isCloudSyncEnabled || !firebaseUserId || initialSyncDone.current) {
      return;
    }

    const syncWithFirestore = async () => {
      setIsSyncing(true);
      try {
        const firebase = await getFirebaseModule();
        const firestoreFavorites = await firebase.getFavoritesFromFirestore(firebaseUserId);

        // Get current local data
        const localActresses = new Set<number>();
        const localProducts = new Set<string>();
        try {
          const actressData = localStorage.getItem(STORAGE_KEYS.FAVORITE_ACTRESSES);
          if (actressData) {
            JSON.parse(actressData).forEach((id: number) => localActresses.add(id));
          }
        } catch {
          /* ignore */
        }
        try {
          const productData = localStorage.getItem(STORAGE_KEYS.FAVORITE_PRODUCTS);
          if (productData) {
            JSON.parse(productData).forEach((id: string) => localProducts.add(id));
          }
        } catch {
          /* ignore */
        }

        // Merge Firestore data with local data
        const mergedActresses = new Set(localActresses);
        const mergedProducts = new Set(localProducts);

        for (const fav of firestoreFavorites) {
          if (fav.type === 'actress') {
            const id = parseInt(fav.itemId, 10);
            if (!isNaN(id)) {
              mergedActresses.add(id);
            }
          } else if (fav.type === 'product') {
            mergedProducts.add(fav.itemId);
          }
        }

        // Upload local items that aren't in Firestore
        const firestoreIds = new Set(firestoreFavorites.map((f) => `${f.type}_${f.itemId}`));

        for (const actressId of localActresses) {
          if (!firestoreIds.has(`actress_${actressId}`)) {
            await firebase.saveFavoriteToFirestore(firebaseUserId, {
              type: 'actress',
              itemId: String(actressId),
            });
          }
        }

        for (const productId of localProducts) {
          if (!firestoreIds.has(`product_${productId}`)) {
            await firebase.saveFavoriteToFirestore(firebaseUserId, {
              type: 'product',
              itemId: productId,
            });
          }
        }

        // Update localStorage with merged data
        localStorage.setItem(STORAGE_KEYS.FAVORITE_ACTRESSES, JSON.stringify(Array.from(mergedActresses)));
        localStorage.setItem(STORAGE_KEYS.FAVORITE_PRODUCTS, JSON.stringify(Array.from(mergedProducts)));
        window.dispatchEvent(new Event('local-storage-update'));

        initialSyncDone.current = true;
      } catch (error) {
        console.error('Failed to sync with Firestore:', error);
      } finally {
        setIsSyncing(false);
      }
    };

    syncWithFirestore();
  }, [isCloudSyncEnabled, firebaseUserId]); // Removed favoriteActresses/Products to prevent loop

  const toggleActressFavorite = useCallback(
    async (actressId: number) => {
      const current = new Set(favoriteActresses);
      const isAdding = !current.has(actressId);

      if (isAdding) {
        current.add(actressId);
      } else {
        current.delete(actressId);
      }

      localStorage.setItem(STORAGE_KEYS.FAVORITE_ACTRESSES, JSON.stringify(Array.from(current)));
      window.dispatchEvent(new Event('local-storage-update'));

      // Sync to Firestore if enabled (fire and forget)
      if (isCloudSyncEnabled && firebaseUserId) {
        getFirebaseModule()
          .then((firebase) => {
            // Log analytics
            firebase.logEvent(isAdding ? 'add_favorite' : 'remove_favorite', {
              item_type: 'actress',
              item_id: String(actressId),
            });

            if (isAdding) {
              firebase
                .saveFavoriteToFirestore(firebaseUserId, {
                  type: 'actress',
                  itemId: String(actressId),
                })
                .catch(console.error);
            } else {
              firebase.removeFavoriteFromFirestore(firebaseUserId, 'actress', String(actressId)).catch(console.error);
            }
          })
          .catch(console.error);
      }
    },
    [favoriteActresses, isCloudSyncEnabled, firebaseUserId],
  );

  const toggleProductFavorite = useCallback(
    async (productId: string) => {
      const current = new Set(favoriteProducts);
      const isAdding = !current.has(productId);

      if (isAdding) {
        current.add(productId);
      } else {
        current.delete(productId);
      }

      localStorage.setItem(STORAGE_KEYS.FAVORITE_PRODUCTS, JSON.stringify(Array.from(current)));
      window.dispatchEvent(new Event('local-storage-update'));

      // Sync to Firestore if enabled (fire and forget)
      if (isCloudSyncEnabled && firebaseUserId) {
        getFirebaseModule()
          .then((firebase) => {
            // Log analytics
            firebase.logEvent(isAdding ? 'add_favorite' : 'remove_favorite', {
              item_type: 'product',
              item_id: productId,
            });

            if (isAdding) {
              firebase
                .saveFavoriteToFirestore(firebaseUserId, {
                  type: 'product',
                  itemId: productId,
                })
                .catch(console.error);
            } else {
              firebase.removeFavoriteFromFirestore(firebaseUserId, 'product', productId).catch(console.error);
            }
          })
          .catch(console.error);
      }
    },
    [favoriteProducts, isCloudSyncEnabled, firebaseUserId],
  );

  const isActressFavorite = useCallback((actressId: number) => favoriteActresses.has(actressId), [favoriteActresses]);
  const isProductFavorite = useCallback((productId: string) => favoriteProducts.has(productId), [favoriteProducts]);

  const value = useMemo(
    () => ({
      favoriteActresses,
      favoriteProducts,
      toggleActressFavorite,
      toggleProductFavorite,
      isActressFavorite,
      isProductFavorite,
      isCloudSyncEnabled,
      isSyncing,
    }),
    [
      favoriteActresses,
      favoriteProducts,
      toggleActressFavorite,
      toggleProductFavorite,
      isActressFavorite,
      isProductFavorite,
      isCloudSyncEnabled,
      isSyncing,
    ],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (context === undefined) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return context;
}
