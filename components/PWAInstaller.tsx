'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { useParams } from 'next/navigation';

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

/**
 * PWAインストールプロンプトイベントの型定義
 * Web標準のBeforeInstallPromptEventを拡張
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export default function PWAInstaller() {
  const params = useParams();
  const locale = (params?.locale as string) || 'ja';
  const t = translations[locale as keyof typeof translations] || translations.ja;
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('SW registered:', registration);
          })
          .catch((error) => {
            console.log('SW registration failed:', error);
          });
      });
    }

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Cleanup
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      return;
    }

    deferredPrompt.prompt();

    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);

    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    // Remember dismissal in localStorage
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  // Don't show if dismissed before or not available
  if (!showInstallPrompt || localStorage.getItem('pwa-install-dismissed') === 'true') {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-4 z-50 animate-slide-up">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Download className="h-5 w-5 text-rose-500" />
          <h3 className="font-semibold text-white">{t.title}</h3>
        </div>
        <button
          onClick={handleDismiss}
          className="text-gray-400 hover:text-white transition-colors"
          aria-label={t.close}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <p className="text-sm text-gray-300 mb-4">
        {t.description}
      </p>

      <div className="flex gap-2">
        <button
          onClick={handleInstallClick}
          className="flex-1 bg-rose-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-rose-700 transition-colors"
        >
          {t.install}
        </button>
        <button
          onClick={handleDismiss}
          className="px-4 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
        >
          {t.later}
        </button>
      </div>
    </div>
  );
}
