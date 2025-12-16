// Re-export from @adult-v/shared for backwards compatibility
export {
  // Firebase app and services
  getFirebaseApp,
  getFirebaseAuth,
  getFirebaseFirestore,
  getFirebaseAnalytics,
  getFirebaseRemoteConfig,
  getFirebaseMessaging,
  getFirebasePerformance,
  isFirebaseConfigured,

  // Auth functions
  signInAnonymouslyIfNeeded,
  linkWithGoogle,
  linkWithTwitter,
  onAuthStateChange,
  isAnonymousUser,

  // Firestore functions
  saveFavoriteToFirestore,
  removeFavoriteFromFirestore,
  getFavoritesFromFirestore,
  saveRecentlyViewedToFirestore,
  getRecentlyViewedFromFirestore,

  // Analytics functions
  logEvent,
  setAnalyticsUserId,
  setAnalyticsUserProperties,

  // Remote Config functions
  fetchRemoteConfig,
  getRemoteConfigValue,

  // Cloud Messaging functions
  requestNotificationPermission,
  saveFcmToken,
  onForegroundMessage,

  // App instance
  app,
} from '@adult-v/shared/lib/firebase';

// Re-export types
export type {
  FirestoreFavorite,
  FirestoreRecentlyViewed,
  AnalyticsEventName,
  AnalyticsEventParams,
  RemoteConfigDefaults,
} from '@adult-v/shared/lib/firebase';
