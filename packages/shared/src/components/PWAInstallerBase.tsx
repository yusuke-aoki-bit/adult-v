'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useSiteTheme, type SiteTheme } from '../contexts/SiteThemeContext';

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
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// Client-side translations (PWAInstaller is outside NextIntlClientProvider)
const translations = {
  ja: {
    title: 'アプリをインストール',
    description: 'ホーム画面に追加して、より快適にご利用いただけます。',
    install: 'インストール',
    later: '後で',
    close: '閉じる',
  },
  en: {
    title: 'Install App',
    description: 'Add to home screen for a better experience.',
    install: 'Install',
    later: 'Later',
    close: 'Close',
  },
  zh: {
    title: '安装应用',
    description: '添加到主屏幕以获得更好的体验。',
    install: '安装',
    later: '稍后',
    close: '关闭',
  },
  ko: {
    title: '앱 설치',
    description: '홈 화면에 추가하여 더 나은 경험을 즐기세요.',
    install: '설치',
    later: '나중에',
    close: '닫기',
  },
} as const;

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
  const t = translations[locale as keyof typeof translations] || translations['ja'];
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isDismissed, setIsDismissed] = useState(true);

  useEffect(() => {
    const dismissed = localStorage.getItem('pwa-install-dismissed') === 'true';
    setIsDismissed(dismissed);

    // Register service worker (本番環境のみ)
    const handleLoad = () => {
      if ('serviceWorker' in navigator && process.env['NODE_ENV'] === 'production') {
        navigator.serviceWorker
          .register('/sw.js')
          .catch(() => {
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
    <div className={`fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 ${tc.container} border rounded-lg shadow-lg p-4 z-50 animate-slide-up`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={tc.accent}><DownloadIcon /></span>
          <h3 className={`font-semibold ${tc.title}`}>{t.title}</h3>
        </div>
        <button
          onClick={handleDismiss}
          className={`${tc.close} transition-colors`}
          aria-label={t.close}
        >
          <CloseIcon />
        </button>
      </div>

      <p className={`text-sm ${tc.description} mb-4`}>
        {t.description}
      </p>

      <div className="flex gap-2">
        <button
          onClick={handleInstallClick}
          className={`flex-1 ${tc.installBtn} text-white px-4 py-2 rounded-lg font-medium transition-colors`}
        >
          {t.install}
        </button>
        <button
          onClick={handleDismiss}
          className={`px-4 py-2 rounded-lg ${tc.laterBtn} transition-colors`}
        >
          {t.later}
        </button>
      </div>
    </div>
  );
}
