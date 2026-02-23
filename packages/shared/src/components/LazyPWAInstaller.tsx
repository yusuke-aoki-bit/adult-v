'use client';

import dynamic from 'next/dynamic';

const PWAInstaller = dynamic(() => import('./PWAInstallerBase'), {
  ssr: false,
  loading: () => null,
});

export function LazyPWAInstaller() {
  return <PWAInstaller />;
}
