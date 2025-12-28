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

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // ブラウザの言語設定から適切な翻訳を取得
  const locale = typeof window !== 'undefined'
    ? (navigator.language.split('-')[0] as keyof typeof translations)
    : defaultLocale;
  const t = translations[locale] || translations[defaultLocale as keyof typeof translations] || translations.en;

  // エラーをSentryとコンソールに記録
  useEffect(() => {
    console.error('Global error:', error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang={locale}>
      <body>
        <div className="min-h-screen bg-white flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-gray-50 rounded-2xl shadow-xl p-8 text-center border border-gray-200">
            <div className="text-6xl mb-4" role="img" aria-label="Error">⚠️</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {t.title}
            </h1>
            <p className="text-gray-600 mb-6">
              {t.description}
            </p>
            {error.digest && (
              <p className="text-xs text-gray-400 mb-4 font-mono">
                {t.errorId}: {error.digest}
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={reset}
                className="px-6 py-3 bg-pink-600 text-white rounded-lg font-semibold hover:bg-pink-500 transition-colors"
              >
                {t.reload}
              </button>
              <a
                href={`/${locale}`}
                className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
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

