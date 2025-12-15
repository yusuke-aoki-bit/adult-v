'use client';

import dynamic from 'next/dynamic';

// PWAInstallerは初期表示には不要なのでdynamic importで遅延読み込み
const PWAInstaller = dynamic(() => import("./PWAInstaller"), {
  ssr: false,
  loading: () => null,
});

export function LazyPWAInstaller() {
  return <PWAInstaller />;
}
