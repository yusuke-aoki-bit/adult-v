'use client';

import React, { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { defaultLocale } from '@/i18n';

const translations = {
  ja: {
    title: '予期しないエラーが発生しました',
    description: 'アプリケーションで重大なエラーが発生しました。ページを再読み込みしてください。',
    reload: 'ページを再読み込み',
    home: 'ホームに戻る',
    errorId: 'エラーID',
  },
  en: {
    title: 'An Unexpected Error Occurred',
    description: 'A critical error occurred in the application. Please reload the page.',
    reload: 'Reload Page',
    home: 'Go to Home',
    errorId: 'Error ID',
  },
  zh: {
    title: '发生意外错误',
    description: '应用程序发生严重错误。请重新加载页面。',
    reload: '重新加载页面',
    home: '返回首页',
    errorId: '错误ID',
  },
  ko: {
    title: '예기치 않은 오류가 발생했습니다',
    description: '애플리케이션에서 심각한 오류가 발생했습니다. 페이지를 다시 로드해 주세요.',
    reload: '페이지 다시 로드',
    home: '홈으로 이동',
    errorId: '오류 ID',
  },
  'zh-TW': {
    title: '發生意外錯誤',
    description: '應用程式發生嚴重錯誤。請重新載入頁面。',
    reload: '重新載入頁面',
    home: '返回首頁',
    errorId: '錯誤ID',
  },
} as const;

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // ブラウザの言語設定から適切な翻訳を取得
  const getLocale = (): keyof typeof translations => {
    if (typeof window === 'undefined') return defaultLocale as keyof typeof translations;
    const lang = navigator.language;
    // zh-TW, zh-HK などの繁体字圏を検出
    if (lang.startsWith('zh-TW') || lang.startsWith('zh-HK')) return 'zh-TW';
    if (lang.startsWith('zh')) return 'zh';
    const baseLang = lang.split('-')[0]!;
    if (baseLang in translations) return baseLang as keyof typeof translations;
    return 'en';
  };
  const locale = getLocale();
  const t = translations[locale];

  // エラーをSentryとコンソールに記録
  useEffect(() => {
    console.error('Global error:', error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang={locale}>
      <body>
        <div className="flex min-h-screen items-center justify-center bg-white px-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-gray-50 p-8 text-center shadow-xl">
            <div className="mb-4 text-6xl" role="img" aria-label="Error">
              ⚠️
            </div>
            <h1 className="mb-2 text-2xl font-bold text-gray-900">{t.title}</h1>
            <p className="mb-6 text-gray-600">{t.description}</p>
            {error.digest && (
              <p className="mb-4 font-mono text-xs text-gray-400">
                {t.errorId}: {error.digest}
              </p>
            )}
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <button
                onClick={reset}
                className="rounded-lg bg-pink-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-pink-500"
              >
                {t.reload}
              </button>
              <a
                href={`/${locale}`}
                className="rounded-lg bg-gray-200 px-6 py-3 font-semibold text-gray-800 transition-colors hover:bg-gray-300"
              >
                {t.home}
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
