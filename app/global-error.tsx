'use client';

import React from 'react';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ja">
      <body>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="text-6xl mb-4">❌</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              重大なエラーが発生しました
            </h1>
            <p className="text-gray-600 mb-6">
              アプリケーションで重大なエラーが発生しました。
              ページを再読み込みしてください。
            </p>
            <button
              onClick={reset}
              className="px-6 py-3 bg-gray-900 text-white rounded-lg font-semibold hover:bg-gray-800 transition-colors"
            >
              ページを再読み込み
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}

