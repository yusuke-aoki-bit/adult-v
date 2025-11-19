'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

function AgeVerificationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isVerifying, setIsVerifying] = useState(false);
  const redirectPath = searchParams.get('redirect') || '/';

  const handleVerify = async () => {
    setIsVerifying(true);

    try {
      // サーバーサイドでセキュアなCookieを設定
      const response = await fetch('/api/age-verify', {
        method: 'POST',
      });

      if (response.ok) {
        // リダイレクト先に移動
        router.push(redirectPath);
      } else {
        setIsVerifying(false);
      }
    } catch (error) {
      console.error('Age verification failed:', error);
      setIsVerifying(false);
    }
  };

  const handleReject = () => {
    // 年齢確認を拒否した場合、外部サイトにリダイレクト
    window.location.href = 'https://www.google.com';
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4 z-50">
      <div className="max-w-2xl w-full bg-white rounded-3xl shadow-2xl p-8 md:p-12 text-center">
        {/* 警告アイコン */}
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-4">
            <svg
              className="w-12 h-12 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
        </div>

        {/* タイトル */}
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
          18歳未満閲覧禁止
        </h1>

        {/* 説明文 */}
        <div className="space-y-4 mb-8 text-gray-700">
          <p className="text-lg leading-relaxed">
            本サイトは18歳以上の方のみご利用いただけます。
          </p>
          <p className="text-base">
            18歳未満の方のご利用は法律により禁止されております。
          </p>
          <div className="bg-red-50 border-l-4 border-red-500 p-4 my-6 text-left">
            <p className="text-sm text-red-800 font-semibold mb-2">
              ⚠️ ご注意
            </p>
            <ul className="text-sm text-red-700 space-y-1 list-disc list-inside">
              <li>本サイトはアダルトコンテンツを含みます</li>
              <li>18歳未満の方の閲覧は法律で禁止されています</li>
              <li>年齢確認は30日間有効です</li>
            </ul>
          </div>
        </div>

        {/* ボタン */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={handleVerify}
            disabled={isVerifying}
            className="px-8 py-4 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-lg"
          >
            {isVerifying ? '確認中...' : '18歳以上であることを確認'}
          </button>
          <button
            onClick={handleReject}
            className="px-8 py-4 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors text-lg"
          >
            18歳未満です
          </button>
        </div>

        {/* フッター */}
        <p className="text-xs text-gray-500 mt-8">
          本サイトにアクセスすることで、あなたが18歳以上であることを確認したものとみなされます。
        </p>
      </div>
    </div>
  );
}

export default function AgeVerificationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
          <div className="text-white">読み込み中...</div>
        </div>
      }
    >
      <AgeVerificationContent />
    </Suspense>
  );
}

