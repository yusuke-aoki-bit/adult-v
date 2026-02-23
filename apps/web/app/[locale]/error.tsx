'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('error');
  const locale = useLocale();

  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900 px-4">
      <div className="w-full max-w-md rounded-2xl bg-gray-800 p-8 text-center shadow-xl">
        <div className="mb-4 text-6xl">⚠️</div>
        <h1 className="mb-2 text-2xl font-bold text-white">{t('errorOccurred')}</h1>
        <p className="mb-6 text-gray-300">{t('errorMessage')}</p>
        {process.env['NODE_ENV'] === 'development' && error.message && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 text-left">
            <p className="mb-2 text-sm font-semibold text-red-900">{t('errorDetails')}</p>
            <p className="font-mono text-xs break-all text-red-700">{error.message}</p>
          </div>
        )}
        <div className="flex flex-col justify-center gap-4 sm:flex-row">
          <button
            onClick={reset}
            className="rounded-lg bg-gray-900 px-6 py-3 font-semibold text-white transition-colors hover:bg-gray-800"
          >
            {t('retry')}
          </button>
          <Link
            href={`/${locale}`}
            className="rounded-lg bg-gray-700 px-6 py-3 font-semibold text-gray-200 transition-colors hover:bg-gray-600"
          >
            {t('goHome')}
          </Link>
        </div>
      </div>
    </div>
  );
}
