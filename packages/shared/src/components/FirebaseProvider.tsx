'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import {
  logEvent,
  fetchRemoteConfig,
  getFirebasePerformance,
} from '../lib/firebase';

interface FirebaseProviderProps {
  children: React.ReactNode;
}

export function FirebaseProvider({ children }: FirebaseProviderProps) {
  const pathname = usePathname();

  // Initialize Firebase services on mount
  useEffect(() => {
    // Initialize Performance Monitoring (just accessing it initializes it)
    getFirebasePerformance();

    // Fetch remote config on initial load
    fetchRemoteConfig();
  }, []);

  // Track page views on route change
  useEffect(() => {
    if (pathname) {
      // Get page title from document
      const pageTitle = typeof document !== 'undefined' ? document.title : pathname;
      logEvent('page_view', {
        page_path: pathname,
        page_title: pageTitle,
      });
    }
  }, [pathname]);

  return <>{children}</>;
}
