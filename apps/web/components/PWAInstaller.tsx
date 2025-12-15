'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

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
  const [isDismissed, setIsDismissed] = useState(true); // デフォルトで非表示

  useEffect(() => {
    // クライアントサイドでのみlocalStorageをチェック
    const dismissed = localStorage.getItem('pwa-install-dismissed') === 'true';
    setIsDismissed(dismissed);

    // Register service worker (本番環境のみ、エラーログは抑制)
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .catch(() => {
            // SW登録失敗は静かに無視（コンソールエラー抑制）
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
    await deferredPrompt.userChoice;

    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    setIsDismissed(true);
    // Remember dismissal in localStorage
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  // Don't show if dismissed before or not available
  if (!showInstallPrompt || isDismissed) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-4 z-50 animate-slide-up">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-rose-500"><DownloadIcon /></span>
          <h3 className="font-semibold text-white">{t.title}</h3>
        </div>
        <button
          onClick={handleDismiss}
          className="text-gray-300 hover:text-white transition-colors"
          aria-label={t.close}
        >
          <CloseIcon />
        </button>
      </div>

      <p className="text-sm text-gray-200 mb-4">
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
          className="px-4 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
        >
          {t.later}
        </button>
      </div>
    </div>
  );
}
