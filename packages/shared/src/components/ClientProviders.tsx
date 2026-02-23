'use client';

import React from 'react';
import { FirebaseAuthProvider } from '../contexts/FirebaseAuthContext';

interface ClientProvidersProps {
  children: React.ReactNode;
  /** Delay auto sign-in by specified milliseconds (default: 1000) */
  autoSignInDelay?: number;
  /** Disable auto sign-in entirely */
  disableAutoSignIn?: boolean;
}

/**
 * Client-side providers wrapper
 * Wraps children with FirebaseAuthProvider for cloud sync features
 */
export function ClientProviders({ children, autoSignInDelay = 1000, disableAutoSignIn = false }: ClientProvidersProps) {
  return <FirebaseAuthProvider autoSignIn={!disableAutoSignIn}>{children}</FirebaseAuthProvider>;
}
