'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useSiteTheme, type SiteTheme } from '../contexts/SiteThemeContext';
import { getTranslation, pwaInstallerTranslations } from '../lib/translations';

const themeClasses = {
  dark: {
    container: 'bg-gray-800 border-gray-700',
    title: 'text-white',
    accent: 'text-rose-500',
    close: 'text-gray-300 hover:text-white',
    description: 'text-gray-200',
    installBtn: 'bg-rose-600 hover:bg-rose-700',
    laterBtn: 'text-gray-300 hover:text-white hover:bg-gray-700',
  },
  light: {
    container: 'bg-white border-gray-200',
    title: 'text-gray-800',
    accent: 'text-rose-700',
    close: 'text-gray-500 hover:text-gray-700',
    description: 'text-gray-600',
    installBtn: 'bg-rose-700 hover:bg-rose-800',
    laterBtn: 'text-gray-600 hover:text-gray-800 hover:bg-gray-100',
  },
} as const;

function getTheme(theme: SiteTheme) {
  return themeClasses[theme];
}

// SVGアイコン（lucide-reactを避けてバンドルサイズ削減）
const DownloadIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const CloseIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export default function PWAInstallerBase() {
  const { theme } = useSiteTheme();
  const tc = getTheme(theme);
  const params = useParams();
  const locale = (params?.['locale'] as string) || 'ja';
  const t = getTranslation(pwaInstallerTranslations, locale);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isDismissed, setIsDismissed] = useState(true);

  useEffect(() => {
    const dismissed = localStorage.getItem('pwa-install-dismissed') === 'true';
    setIsDismissed(dismissed);

    // Register service worker (本番環境のみ)
    const handleLoad = () => {
      if ('serviceWorker' in navigator && process.env['NODE_ENV'] === 'production') {
        navigator.serviceWorker.register('/sw.js').catch(() => {
          // SW登録失敗は静かに無視
        });
      }
    };
    window.addEventListener('load', handleLoad);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('load', handleLoad);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      return;
    }

    deferredPrompt.prompt();
    await deferredPrompt.userChoice;

    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    setIsDismissed(true);
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  if (!showInstallPrompt || isDismissed) {
    return null;
  }

  return (
    <div
      className={`fixed right-4 bottom-4 left-4 md:right-4 md:left-auto md:w-96 ${tc.container} animate-slide-up z-50 rounded-lg border p-4 shadow-lg`}
    >
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className={tc.accent}>
            <DownloadIcon />
          </span>
          <h3 className={`font-semibold ${tc.title}`}>{t.title}</h3>
        </div>
        <button onClick={handleDismiss} className={`${tc.close} transition-colors`} aria-label={t.close}>
          <CloseIcon />
        </button>
      </div>

      <p className={`text-sm ${tc.description} mb-4`}>{t.description}</p>

      <div className="flex gap-2">
        <button
          onClick={handleInstallClick}
          className={`flex-1 ${tc.installBtn} rounded-lg px-4 py-2 font-medium text-white transition-colors`}
        >
          {t.install}
        </button>
        <button onClick={handleDismiss} className={`rounded-lg px-4 py-2 ${tc.laterBtn} transition-colors`}>
          {t.later}
        </button>
      </div>
    </div>
  );
}
