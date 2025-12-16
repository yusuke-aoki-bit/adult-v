'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import type { User } from 'firebase/auth';
import {
  isFirebaseConfigured,
  signInAnonymouslyIfNeeded,
  linkWithGoogle,
  linkWithTwitter,
  onAuthStateChange,
  setAnalyticsUserId,
  fetchRemoteConfig,
  getRemoteConfigValue,
  type RemoteConfigDefaults,
} from '../lib/firebase';

interface FirebaseAuthContextType {
  // Auth state
  user: User | null;
  isLoading: boolean;
  isAnonymous: boolean;
  isAuthenticated: boolean;
  isFirebaseEnabled: boolean;

  // Auth actions
  signInAnonymously: () => Promise<void>;
  linkGoogle: () => Promise<boolean>;
  linkTwitter: () => Promise<boolean>;

  // Remote Config
  remoteConfig: RemoteConfigDefaults | null;
  refreshRemoteConfig: () => Promise<void>;
}

const FirebaseAuthContext = createContext<FirebaseAuthContextType | undefined>(undefined);

interface FirebaseAuthProviderProps {
  children: ReactNode;
  autoSignIn?: boolean; // Auto sign in anonymously on mount
}

export function FirebaseAuthProvider({
  children,
  autoSignIn = true,
}: FirebaseAuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [remoteConfig, setRemoteConfig] = useState<RemoteConfigDefaults | null>(null);

  const isFirebaseEnabled = isFirebaseConfigured();

  // Subscribe to auth state changes
  useEffect(() => {
    if (!isFirebaseEnabled) {
      setIsLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChange((authUser) => {
      setUser(authUser);
      setIsLoading(false);

      // Set analytics user ID
      if (authUser) {
        setAnalyticsUserId(authUser.uid);
      }
    });

    return unsubscribe;
  }, [isFirebaseEnabled]);

  // Auto sign in anonymously
  useEffect(() => {
    if (!isFirebaseEnabled || !autoSignIn || user || isLoading) return;

    // Small delay to avoid blocking initial render
    const timer = setTimeout(() => {
      signInAnonymouslyIfNeeded();
    }, 1000);

    return () => clearTimeout(timer);
  }, [isFirebaseEnabled, autoSignIn, user, isLoading]);

  // Fetch remote config on mount
  useEffect(() => {
    if (!isFirebaseEnabled) return;

    const loadRemoteConfig = async () => {
      await fetchRemoteConfig();
      setRemoteConfig({
        enable_new_feature: getRemoteConfigValue('enable_new_feature'),
        maintenance_mode: getRemoteConfigValue('maintenance_mode'),
        maintenance_message: getRemoteConfigValue('maintenance_message'),
        ab_test_variant: getRemoteConfigValue('ab_test_variant'),
        max_favorites: getRemoteConfigValue('max_favorites'),
        show_promotions: getRemoteConfigValue('show_promotions'),
      });
    };

    loadRemoteConfig();
  }, [isFirebaseEnabled]);

  const handleSignInAnonymously = useCallback(async () => {
    if (!isFirebaseEnabled) return;
    setIsLoading(true);
    await signInAnonymouslyIfNeeded();
    setIsLoading(false);
  }, [isFirebaseEnabled]);

  const handleLinkGoogle = useCallback(async (): Promise<boolean> => {
    if (!isFirebaseEnabled) return false;
    const result = await linkWithGoogle();
    return !!result;
  }, [isFirebaseEnabled]);

  const handleLinkTwitter = useCallback(async (): Promise<boolean> => {
    if (!isFirebaseEnabled) return false;
    const result = await linkWithTwitter();
    return !!result;
  }, [isFirebaseEnabled]);

  const refreshRemoteConfig = useCallback(async () => {
    if (!isFirebaseEnabled) return;
    await fetchRemoteConfig();
    setRemoteConfig({
      enable_new_feature: getRemoteConfigValue('enable_new_feature'),
      maintenance_mode: getRemoteConfigValue('maintenance_mode'),
      maintenance_message: getRemoteConfigValue('maintenance_message'),
      ab_test_variant: getRemoteConfigValue('ab_test_variant'),
      max_favorites: getRemoteConfigValue('max_favorites'),
      show_promotions: getRemoteConfigValue('show_promotions'),
    });
  }, [isFirebaseEnabled]);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAnonymous: user?.isAnonymous ?? true,
      isAuthenticated: !!user && !user.isAnonymous,
      isFirebaseEnabled,
      signInAnonymously: handleSignInAnonymously,
      linkGoogle: handleLinkGoogle,
      linkTwitter: handleLinkTwitter,
      remoteConfig,
      refreshRemoteConfig,
    }),
    [
      user,
      isLoading,
      isFirebaseEnabled,
      handleSignInAnonymously,
      handleLinkGoogle,
      handleLinkTwitter,
      remoteConfig,
      refreshRemoteConfig,
    ]
  );

  return (
    <FirebaseAuthContext.Provider value={value}>
      {children}
    </FirebaseAuthContext.Provider>
  );
}

export function useFirebaseAuth() {
  const context = useContext(FirebaseAuthContext);
  if (context === undefined) {
    throw new Error('useFirebaseAuth must be used within a FirebaseAuthProvider');
  }
  return context;
}

// Hook for remote config values
export function useRemoteConfig<K extends keyof RemoteConfigDefaults>(
  key: K
): RemoteConfigDefaults[K] | undefined {
  const { remoteConfig } = useFirebaseAuth();
  return remoteConfig?.[key];
}
