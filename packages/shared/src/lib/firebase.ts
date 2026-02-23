'use client';

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider, type AppCheck } from 'firebase/app-check';
import {
  getAuth,
  signInAnonymously,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  TwitterAuthProvider,
  linkWithPopup,
  signInWithPopup,
  signInWithCredential,
  type User,
  type Auth,
  type AuthError,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  deleteDoc,
  serverTimestamp,
  type Firestore,
} from 'firebase/firestore';
import {
  getAnalytics,
  logEvent as firebaseLogEvent,
  setUserId,
  setUserProperties,
  type Analytics,
} from 'firebase/analytics';
import { getRemoteConfig, fetchAndActivate, getValue, type RemoteConfig } from 'firebase/remote-config';
import { getMessaging, getToken, onMessage, type Messaging } from 'firebase/messaging';
import { getPerformance, type FirebasePerformance } from 'firebase/performance';

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env['NEXT_PUBLIC_FIREBASE_API_KEY'] ?? '',
  authDomain: process.env['NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'] ?? '',
  projectId: process.env['NEXT_PUBLIC_FIREBASE_PROJECT_ID'] ?? '',
  storageBucket: process.env['NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'] ?? '',
  messagingSenderId: process.env['NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'] ?? '',
  appId: process.env['NEXT_PUBLIC_FIREBASE_APP_ID'] ?? '',
  measurementId: process.env['NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID'] ?? '',
};

// Singleton instances
let app: FirebaseApp | null = null;
let appCheck: AppCheck | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let analytics: Analytics | null = null;
let remoteConfig: RemoteConfig | null = null;
let messaging: Messaging | null = null;
let performance: FirebasePerformance | null = null;

// Check if Firebase is configured
export function isFirebaseConfigured(): boolean {
  return !!(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
}

// Initialize Firebase app
export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured()) {
    console.warn('Firebase is not configured. Skipping initialization.');
    return null;
  }

  if (!app) {
    const existingApps = getApps();
    if (existingApps.length === 0) {
      // isFirebaseConfigured() already checks that required fields are defined
      // Use spread to conditionally add optional properties only when defined
      const config = {
        apiKey: firebaseConfig.apiKey!,
        projectId: firebaseConfig.projectId!,
        appId: firebaseConfig.appId!,
        ...(firebaseConfig.authDomain ? { authDomain: firebaseConfig.authDomain } : {}),
        ...(firebaseConfig.storageBucket ? { storageBucket: firebaseConfig.storageBucket } : {}),
        ...(firebaseConfig.messagingSenderId ? { messagingSenderId: firebaseConfig.messagingSenderId } : {}),
        ...(firebaseConfig.measurementId ? { measurementId: firebaseConfig.measurementId } : {}),
      };
      app = initializeApp(config);
    } else {
      const firstApp = existingApps[0];
      app = firstApp !== undefined ? firstApp : null;
    }
  }
  return app;
}

// Initialize Firebase App Check
export function getFirebaseAppCheck(): AppCheck | null {
  if (typeof window === 'undefined') return null;

  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;

  if (!appCheck) {
    const siteKey = process.env['NEXT_PUBLIC_RECAPTCHA_SITE_KEY'];
    if (!siteKey) {
      // reCAPTCHA未設定時は静かにスキップ（本番で毎回ログが出るのを防止）
      return null;
    }

    try {
      // Enable debug token in development
      if (process.env['NODE_ENV'] === 'development') {
        // @ts-expect-error - Debug token for development
        self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
      }

      appCheck = initializeAppCheck(firebaseApp, {
        provider: new ReCaptchaV3Provider(siteKey),
        isTokenAutoRefreshEnabled: true,
      });
    } catch (error) {
      console.error('Failed to initialize App Check:', error);
      return null;
    }
  }
  return appCheck;
}

// Initialize Firebase Auth
export function getFirebaseAuth(): Auth | null {
  if (typeof window === 'undefined') return null;

  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;

  // Initialize App Check before other services
  getFirebaseAppCheck();

  if (!auth) {
    auth = getAuth(firebaseApp);
  }
  return auth;
}

// Initialize Firestore
export function getFirebaseFirestore(): Firestore | null {
  if (typeof window === 'undefined') return null;

  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;

  // Initialize App Check before other services
  getFirebaseAppCheck();

  if (!db) {
    db = getFirestore(firebaseApp);
  }
  return db;
}

// Initialize Analytics
export function getFirebaseAnalytics(): Analytics | null {
  if (typeof window === 'undefined') return null;

  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;

  if (!analytics) {
    analytics = getAnalytics(firebaseApp);
  }
  return analytics;
}

// Initialize Remote Config
export function getFirebaseRemoteConfig(): RemoteConfig | null {
  if (typeof window === 'undefined') return null;

  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;

  if (!remoteConfig) {
    remoteConfig = getRemoteConfig(firebaseApp);
    // Set minimum fetch interval for development
    remoteConfig.settings.minimumFetchIntervalMillis = process.env['NODE_ENV'] === 'development' ? 0 : 3600000; // 1 hour in production
  }
  return remoteConfig;
}

// Initialize Cloud Messaging
export function getFirebaseMessaging(): Messaging | null {
  if (typeof window === 'undefined') return null;

  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;

  if (!messaging) {
    messaging = getMessaging(firebaseApp);
  }
  return messaging;
}

// Initialize Performance Monitoring
export function getFirebasePerformance(): FirebasePerformance | null {
  if (typeof window === 'undefined') return null;

  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;

  if (!performance) {
    try {
      performance = getPerformance(firebaseApp);
      // Disable automatic instrumentation to avoid errors with long class names
      // Firebase Performance has a 100 char limit on attribute values
      performance.instrumentationEnabled = true;
      performance.dataCollectionEnabled = true;
    } catch (error) {
      // Ignore initialization errors (e.g., invalid attribute values)
      console.warn('Firebase Performance initialization warning:', error);
    }
  }
  return performance;
}

// ============================================
// Authentication Functions
// ============================================

// Sign in anonymously (no user interaction required)
export async function signInAnonymouslyIfNeeded(): Promise<User | null> {
  const firebaseAuth = getFirebaseAuth();
  if (!firebaseAuth) return null;

  // If already signed in, return current user
  if (firebaseAuth.currentUser) {
    return firebaseAuth.currentUser;
  }

  try {
    const result = await signInAnonymously(firebaseAuth);
    return result.user;
  } catch (error) {
    console.error('Anonymous sign-in failed:', error);
    return null;
  }
}

// Link anonymous account with Google, or sign in directly if no current user
export async function linkWithGoogle(): Promise<User | null> {
  const firebaseAuth = getFirebaseAuth();
  if (!firebaseAuth) return null;

  const provider = new GoogleAuthProvider();

  // Already signed in with a provider (not anonymous), just return current user
  if (firebaseAuth.currentUser && !firebaseAuth.currentUser.isAnonymous) {
    return firebaseAuth.currentUser;
  }

  // If user is anonymous, try to link with Google first
  if (firebaseAuth.currentUser?.isAnonymous) {
    try {
      const result = await linkWithPopup(firebaseAuth.currentUser, provider);
      return result.user;
    } catch (error: unknown) {
      // Handle credential-already-in-use error (Google account already linked to another user)
      // Use the credential from the error to sign in without another popup
      const authError = error as AuthError;
      if (authError.code === 'auth/credential-already-in-use') {
        console.log('Google account already exists, signing in with existing account...');
        // Get credential from the error to avoid second popup
        const credential = GoogleAuthProvider.credentialFromError(authError);
        if (credential) {
          try {
            // Sign out anonymous user first
            await firebaseSignOut(firebaseAuth);
            // Sign in with the credential (no popup needed)
            const result = await signInWithCredential(firebaseAuth, credential);
            return result.user;
          } catch (signInError) {
            console.error('Google sign-in with credential failed:', signInError);
          }
        }
        // Fallback: if credential extraction failed, we need another popup
        // But first sign out to avoid conflict
        await firebaseSignOut(firebaseAuth);
      } else {
        console.error('Google link failed:', error);
        return null;
      }
    }
  }

  // Sign in directly with Google (no current user, or fallback after credential extraction failed)
  try {
    const result = await signInWithPopup(firebaseAuth, provider);
    return result.user;
  } catch (error) {
    console.error('Google sign-in failed:', error);
    return null;
  }
}

// Link anonymous account with Twitter, or sign in directly if no current user
export async function linkWithTwitter(): Promise<User | null> {
  const firebaseAuth = getFirebaseAuth();
  if (!firebaseAuth) return null;

  const provider = new TwitterAuthProvider();

  // Already signed in with a provider (not anonymous), just return current user
  if (firebaseAuth.currentUser && !firebaseAuth.currentUser.isAnonymous) {
    return firebaseAuth.currentUser;
  }

  // If user is anonymous, try to link with Twitter first
  if (firebaseAuth.currentUser?.isAnonymous) {
    try {
      const result = await linkWithPopup(firebaseAuth.currentUser, provider);
      return result.user;
    } catch (error: unknown) {
      // Handle credential-already-in-use error (Twitter account already linked to another user)
      // Use the credential from the error to sign in without another popup
      const authError = error as AuthError;
      if (authError.code === 'auth/credential-already-in-use') {
        console.log('Twitter account already exists, signing in with existing account...');
        // Get credential from the error to avoid second popup
        const credential = TwitterAuthProvider.credentialFromError(authError);
        if (credential) {
          try {
            // Sign out anonymous user first
            await firebaseSignOut(firebaseAuth);
            // Sign in with the credential (no popup needed)
            const result = await signInWithCredential(firebaseAuth, credential);
            return result.user;
          } catch (signInError) {
            console.error('Twitter sign-in with credential failed:', signInError);
          }
        }
        // Fallback: if credential extraction failed, we need another popup
        // But first sign out to avoid conflict
        await firebaseSignOut(firebaseAuth);
      } else {
        console.error('Twitter link failed:', error);
        return null;
      }
    }
  }

  // Sign in directly with Twitter (no current user, or fallback after credential extraction failed)
  try {
    const result = await signInWithPopup(firebaseAuth, provider);
    return result.user;
  } catch (error) {
    console.error('Twitter sign-in failed:', error);
    return null;
  }
}

// Subscribe to auth state changes
export function onAuthStateChange(callback: (user: User | null) => void): () => void {
  const firebaseAuth = getFirebaseAuth();
  if (!firebaseAuth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(firebaseAuth, callback);
}

// Check if user is anonymous
export function isAnonymousUser(): boolean {
  const firebaseAuth = getFirebaseAuth();
  return firebaseAuth?.currentUser?.isAnonymous ?? true;
}

// Sign out current user
export async function signOut(): Promise<boolean> {
  const firebaseAuth = getFirebaseAuth();
  if (!firebaseAuth) return false;

  try {
    await firebaseSignOut(firebaseAuth);
    return true;
  } catch (error) {
    console.error('Sign out failed:', error);
    return false;
  }
}

// ============================================
// Firestore Functions (for favorites/history)
// ============================================

export interface FirestoreFavorite {
  type: 'product' | 'actress';
  itemId: string;
  title?: string;
  name?: string;
  thumbnail?: string;
  addedAt: ReturnType<typeof serverTimestamp>;
}

export interface FirestoreRecentlyViewed {
  itemId: string;
  title: string;
  imageUrl: string | null;
  aspName: string;
  viewedAt: ReturnType<typeof serverTimestamp>;
}

// Save favorite to Firestore
export async function saveFavoriteToFirestore(
  userId: string,
  favorite: Omit<FirestoreFavorite, 'addedAt'>,
): Promise<boolean> {
  const firestore = getFirebaseFirestore();
  if (!firestore) return false;

  try {
    const docRef = doc(firestore, 'users', userId, 'favorites', `${favorite.type}_${favorite.itemId}`);
    await setDoc(docRef, {
      ...favorite,
      addedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error('Failed to save favorite:', error);
    return false;
  }
}

// Remove favorite from Firestore
export async function removeFavoriteFromFirestore(
  userId: string,
  type: 'product' | 'actress',
  itemId: string,
): Promise<boolean> {
  const firestore = getFirebaseFirestore();
  if (!firestore) return false;

  try {
    const docRef = doc(firestore, 'users', userId, 'favorites', `${type}_${itemId}`);
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    console.error('Failed to remove favorite:', error);
    return false;
  }
}

// Get all favorites from Firestore
export async function getFavoritesFromFirestore(userId: string): Promise<FirestoreFavorite[]> {
  const firestore = getFirebaseFirestore();
  if (!firestore) return [];

  try {
    const favoritesRef = collection(firestore, 'users', userId, 'favorites');
    const q = query(favoritesRef, orderBy('addedAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => doc.data() as FirestoreFavorite);
  } catch (error) {
    console.error('Failed to get favorites:', error);
    return [];
  }
}

// Save recently viewed to Firestore
export async function saveRecentlyViewedToFirestore(
  userId: string,
  item: Omit<FirestoreRecentlyViewed, 'viewedAt'>,
): Promise<boolean> {
  const firestore = getFirebaseFirestore();
  if (!firestore) return false;

  try {
    const docRef = doc(firestore, 'users', userId, 'recentlyViewed', item.itemId);
    await setDoc(docRef, {
      ...item,
      viewedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error('Failed to save recently viewed:', error);
    return false;
  }
}

// Get recently viewed from Firestore
export async function getRecentlyViewedFromFirestore(
  userId: string,
  maxItems: number = 20,
): Promise<FirestoreRecentlyViewed[]> {
  const firestore = getFirebaseFirestore();
  if (!firestore) return [];

  try {
    const recentRef = collection(firestore, 'users', userId, 'recentlyViewed');
    const q = query(recentRef, orderBy('viewedAt', 'desc'), limit(maxItems));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => doc.data() as FirestoreRecentlyViewed);
  } catch (error) {
    console.error('Failed to get recently viewed:', error);
    return [];
  }
}

// ============================================
// Watchlist (Watch Later) Functions
// ============================================

export interface FirestoreWatchlistItem {
  productId: string;
  title: string;
  thumbnail?: string;
  provider?: string;
  addedAt: ReturnType<typeof serverTimestamp>;
}

// Save watchlist item to Firestore
export async function saveWatchlistItemToFirestore(
  userId: string,
  item: Omit<FirestoreWatchlistItem, 'addedAt'>,
): Promise<boolean> {
  const firestore = getFirebaseFirestore();
  if (!firestore) return false;

  try {
    const docRef = doc(firestore, 'users', userId, 'watchlist', item['productId']);
    await setDoc(docRef, {
      ...item,
      addedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error('Failed to save watchlist item:', error);
    return false;
  }
}

// Remove watchlist item from Firestore
export async function removeWatchlistItemFromFirestore(userId: string, productId: string): Promise<boolean> {
  const firestore = getFirebaseFirestore();
  if (!firestore) return false;

  try {
    const docRef = doc(firestore, 'users', userId, 'watchlist', productId);
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    console.error('Failed to remove watchlist item:', error);
    return false;
  }
}

// Get all watchlist items from Firestore
export async function getWatchlistFromFirestore(
  userId: string,
  maxItems: number = 100,
): Promise<FirestoreWatchlistItem[]> {
  const firestore = getFirebaseFirestore();
  if (!firestore) return [];

  try {
    const watchlistRef = collection(firestore, 'users', userId, 'watchlist');
    const q = query(watchlistRef, orderBy('addedAt', 'desc'), limit(maxItems));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => d.data() as FirestoreWatchlistItem);
  } catch (error) {
    console.error('Failed to get watchlist:', error);
    return [];
  }
}

// ============================================
// Analytics Functions
// ============================================

export type AnalyticsEventName =
  | 'page_view'
  | 'search'
  | 'view_product'
  | 'add_favorite'
  | 'remove_favorite'
  | 'click_affiliate_link'
  | 'filter_applied'
  | 'sort_changed'
  | 'age_verified'
  | 'theme_changed'
  | 'language_changed'
  | 'notification_permission_granted'
  | 'notification_permission_denied';

export interface AnalyticsEventParams {
  page_view: { page_path: string; page_title?: string };
  search: { search_term: string; results_count?: number };
  view_product: { product_id: string; product_title?: string; provider?: string };
  add_favorite: { item_type: 'product' | 'actress'; item_id: string };
  remove_favorite: { item_type: 'product' | 'actress'; item_id: string };
  click_affiliate_link: { product_id: string; provider: string; destination_url?: string };
  filter_applied: { filter_type: string; filter_value: string };
  sort_changed: { sort_by: string };
  age_verified: Record<string, never>;
  theme_changed: { theme: 'dark' | 'light' };
  language_changed: { language: string };
  notification_permission_granted: Record<string, never>;
  notification_permission_denied: Record<string, never>;
}

// Log analytics event
export function logEvent<T extends AnalyticsEventName>(eventName: T, params?: AnalyticsEventParams[T]): void {
  const firebaseAnalytics = getFirebaseAnalytics();
  if (!firebaseAnalytics) return;

  try {
    // Use type assertion for custom event names
    firebaseLogEvent(firebaseAnalytics, eventName as string, params as Record<string, unknown>);
  } catch (error) {
    console.error('Failed to log analytics event:', error);
  }
}

// Set user ID for analytics
export function setAnalyticsUserId(userId: string | null): void {
  const firebaseAnalytics = getFirebaseAnalytics();
  if (!firebaseAnalytics) return;

  try {
    setUserId(firebaseAnalytics, userId);
  } catch (error) {
    console.error('Failed to set analytics user ID:', error);
  }
}

// Set user properties for analytics
export function setAnalyticsUserProperties(properties: Record<string, string>): void {
  const firebaseAnalytics = getFirebaseAnalytics();
  if (!firebaseAnalytics) return;

  try {
    setUserProperties(firebaseAnalytics, properties);
  } catch (error) {
    console.error('Failed to set analytics user properties:', error);
  }
}

// ============================================
// Remote Config Functions
// ============================================

export interface RemoteConfigDefaults {
  enable_new_feature: boolean;
  maintenance_mode: boolean;
  maintenance_message: string;
  ab_test_variant: string;
  max_favorites: number;
  show_promotions: boolean;
}

const remoteConfigDefaults: RemoteConfigDefaults = {
  enable_new_feature: false,
  maintenance_mode: false,
  maintenance_message: '',
  ab_test_variant: 'control',
  max_favorites: 100,
  show_promotions: true,
};

// Fetch and activate remote config
export async function fetchRemoteConfig(): Promise<boolean> {
  const rc = getFirebaseRemoteConfig();
  if (!rc) return false;

  try {
    await fetchAndActivate(rc);
    return true;
  } catch (error) {
    console.error('Failed to fetch remote config:', error);
    return false;
  }
}

// Get remote config value
export function getRemoteConfigValue<K extends keyof RemoteConfigDefaults>(key: K): RemoteConfigDefaults[K] {
  const rc = getFirebaseRemoteConfig();
  if (!rc) return remoteConfigDefaults[key];

  try {
    const value = getValue(rc, key);

    // Type-safe value parsing
    const defaultValue = remoteConfigDefaults[key];
    if (typeof defaultValue === 'boolean') {
      return value.asBoolean() as RemoteConfigDefaults[K];
    } else if (typeof defaultValue === 'number') {
      return value.asNumber() as RemoteConfigDefaults[K];
    } else {
      return value.asString() as RemoteConfigDefaults[K];
    }
  } catch {
    return remoteConfigDefaults[key];
  }
}

// ============================================
// Cloud Messaging Functions
// ============================================

// Request notification permission and get FCM token
export async function requestNotificationPermission(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  if (!('Notification' in window)) return null;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    logEvent('notification_permission_denied');
    return null;
  }

  logEvent('notification_permission_granted');

  const fcmMessaging = getFirebaseMessaging();
  if (!fcmMessaging) return null;

  try {
    const vapidKey = process.env['NEXT_PUBLIC_FIREBASE_VAPID_KEY'];
    if (!vapidKey) {
      console.warn('VAPID key not configured');
      return null;
    }
    const token = await getToken(fcmMessaging, { vapidKey });
    return token;
  } catch (error) {
    console.error('Failed to get FCM token:', error);
    return null;
  }
}

// Save FCM token to Firestore
export async function saveFcmToken(userId: string, token: string): Promise<boolean> {
  const firestore = getFirebaseFirestore();
  if (!firestore) return false;

  try {
    const docRef = doc(firestore, 'users', userId, 'tokens', 'fcm');
    await setDoc(docRef, {
      token,
      updatedAt: serverTimestamp(),
      platform: 'web',
    });
    return true;
  } catch (error) {
    console.error('Failed to save FCM token:', error);
    return false;
  }
}

// Listen for foreground messages
export function onForegroundMessage(callback: (payload: unknown) => void): () => void {
  const fcmMessaging = getFirebaseMessaging();
  if (!fcmMessaging) return () => {};

  return onMessage(fcmMessaging, (payload) => {
    callback(payload);
  });
}

// Export Firebase app for direct access if needed
export { app };
