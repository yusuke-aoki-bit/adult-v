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
    // Suppress Firebase Performance errors for long class names
    // Firebase has a 100 char limit on attribute values (e.g., Tailwind class strings)
    const originalConsoleError = console.error;
    console.error = (...args: unknown[]) => {
      const message = args[0];
      if (
        typeof message === 'string' &&
        message.includes('Performance') &&
        message.includes('invalid attribute value')
      ) {
        // Silently ignore this specific error
        return;
      }
      originalConsoleError.apply(console, args);
    };

    // Initialize Performance Monitoring (just accessing it initializes it)
    getFirebasePerformance();

    // Fetch remote config on initial load
    fetchRemoteConfig();

    // Cleanup: restore original console.error
    return () => {
      console.error = originalConsoleError;
    };
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
